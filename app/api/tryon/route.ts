import { randomBytes, randomUUID } from "node:crypto";
import { AppError, failure, json, limitedForm, sameOrigin, uuidPattern } from "@/lib/server/http";
import { authenticatedUser, privateDatabase } from "@/lib/server/database";
import { assertAIConfigured, startPrediction } from "@/lib/server/fashn";
import { hashToken, ipHash, positiveLimit } from "@/lib/server/jobs";
import { privatePhoto } from "@/lib/server/photo";
import type { Category } from "@/lib/catalogue";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const form = await limitedForm(request);
    if (form.get("consent") !== "true") throw new AppError(400, "Please confirm permission to use this photo.");
    const productId = String(form.get("productId") || "");
    const photo = form.get("personImage");
    if (!uuidPattern.test(productId)) throw new AppError(400, "Please select a dress.");
    if (!(photo instanceof File)) throw new AppError(400, "Please upload a customer photo.");
    const database = privateDatabase();
    const { data: product, error } = await database.from("dress_ai_products")
      .select("id,shop_id,owner_id,storage_path,category,active").eq("id", productId).eq("active", true).maybeSingle();
    if (error) throw new AppError(503, "The catalogue could not be loaded.");
    if (!product?.shop_id) throw new AppError(404, "This dress is no longer available.");
    // Public customer previews are an explicit server configuration switch.
    if (process.env.PUBLIC_TRYON_ENABLED !== "true") {
      const { user } = await authenticatedUser(request);
      if (user.id !== product.owner_id) throw new AppError(403, "This dress belongs to another shop.");
    }
    const pathPattern = /^[0-9a-f-]{36}\/([0-9a-f-]{36})\.(jpg|png|webp)$/;
    if (!pathPattern.test(product.storage_path) || !product.storage_path.startsWith(product.owner_id + "/"))
      throw new AppError(400, "Please upload this dress again from the shop dashboard.");
    assertAIConfigured();
    const person = await privatePhoto(photo);
    const id = randomUUID();
    const token = randomBytes(32).toString("hex");
    const { data: reserved, error: reserveError } = await database.rpc("dress_ai_reserve_job", {
      p_id: id, p_shop_id: product.shop_id, p_product_id: product.id,
      p_token_hash: hashToken(token), p_ip_hash: ipHash(request),
      p_shop_limit: positiveLimit("TRYON_SHOP_DAILY_LIMIT", 10, 1000),
      p_ip_limit: positiveLimit("TRYON_IP_DAILY_LIMIT", 5, 100),
      p_global_limit: positiveLimit("TRYON_GLOBAL_DAILY_LIMIT", 100, 10000),
    });
    if (reserveError) throw new AppError(503, "AI previews are temporarily unavailable.");
    if (reserved === "unavailable") throw new AppError(404, "This dress is no longer available.");
    if (reserved !== "ok") throw new AppError(429, reserved === "busy"
      ? "AI previews are busy. Please try again shortly." : "The preview limit has been reached. Please try again tomorrow.");
    try {
      const garment = database.storage.from("dress-ai-catalogue").getPublicUrl(product.storage_path).data.publicUrl;
      const predictionId = await startPrediction(person, garment, product.category as Category);
      const { error: saveError } = await database.from("dress_ai_jobs")
        .update({ provider_id: predictionId, status: "processing" }).eq("id", id);
      if (saveError) throw new AppError(503, "Your preview started, but tracking is temporarily unavailable.");
      return json({ requestId: id, token, status: "processing" }, 202);
    } catch (error) {
      await database.from("dress_ai_jobs").update({ status: "failed" }).eq("id", id);
      throw error;
    }
  } catch (error) { return failure(error); }
}
