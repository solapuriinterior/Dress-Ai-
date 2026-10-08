import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { privateDatabase } from "./database";
import { AppError, uuidPattern } from "./http";
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function ipHash(request: Request) {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const trusted = process.env.VERCEL === "1" || process.env.TRUST_PROXY === "true";
  const address = trusted ? request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown" : "unknown";
  return createHmac("sha256", secret).update(address).digest("hex");
}
export function positiveLimit(name: string, fallback: number, max: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}
export type Job = { id: string; shop_id: string; provider_id: string | null; token_hash: string; status: string; expires_at: string };
export async function authorizedJob(request: Request, id: string): Promise<{ database: SupabaseClient; job: Job }> {
  const token = request.headers.get("x-tryon-token");
  if (!uuidPattern.test(id) || !token || !/^[a-f0-9]{64}$/.test(token)) throw new AppError(404, "Preview not found.");
  const database = privateDatabase();
  const { data, error } = await database.from("dress_ai_jobs")
    .select("id,shop_id,provider_id,token_hash,status,expires_at").eq("id", id).maybeSingle();
  if (error) throw new AppError(503, "The preview could not be retrieved. Please try again.");
  if (!data || !timingSafeEqual(Buffer.from(data.token_hash, "hex"), Buffer.from(hashToken(token), "hex")))
    throw new AppError(404, "Preview not found.");
  if (Date.parse(data.expires_at) < Date.now()) throw new AppError(410, "This preview has expired. Start a new preview.");
  return { database, job: data as Job };
}
