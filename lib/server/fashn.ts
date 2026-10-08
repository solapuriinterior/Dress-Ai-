import "server-only";
import type { Category } from "../catalogue";
import { AppError } from "./http";
const categories: Record<Category, string> = {
  upper_body: "tops", lower_body: "bottoms", full_body: "one-pieces",
};
function config() {
  const key = process.env.FASHN_API_KEY;
  if (!key) throw new AppError(503, "AI previews are not available yet. Please try again later.");
  const endpoint = (process.env.FASHN_API_URL || "https://api.fashn.ai/v1").replace(/\/$/, "");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))
    throw new AppError(503, "AI previews are temporarily unavailable.");
  return { key, endpoint };
}
export function assertAIConfigured() { config(); }
async function providerJSON(path: string, body?: unknown) {
  const { key, endpoint } = config();
  let response: Response;
  try {
    response = await fetch(endpoint + path, {
      method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { Authorization: "Bearer " + key, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new AppError(504, "The AI service did not respond. Please try again later."); }
  if (!response.ok) {
    const status = response.status;
    await response.body?.cancel();
    if (status === 429) throw new AppError(429, "The AI service is busy. Please try again shortly.");
    if (status === 402 || status === 401 || status === 403)
      throw new AppError(503, "AI previews are temporarily unavailable. Please contact the shop.");
    throw new AppError(502, "The AI service could not process this request.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new AppError(502, "The AI service returned an empty response.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 19_000_000) { await reader.cancel(); throw new AppError(502, "The AI result is too large."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>; }
  catch { throw new AppError(502, "The AI service returned an invalid response."); }
}
export async function startPrediction(person: string, garment: string, category: Category) {
  const model = process.env.FASHN_MODEL || "tryon-max";
  if (!["tryon-max", "tryon-v1.6"].includes(model)) throw new AppError(503, "AI previews are temporarily unavailable.");
  const resolution = process.env.FASHN_RESOLUTION || "2k";
  if (!["1k", "2k"].includes(resolution)) throw new AppError(503, "AI previews are temporarily unavailable.");
  const inputs = model === "tryon-max" ? {
    model_image: person, product_image: garment, resolution, generation_mode: "quality",
    num_images: 1, output_format: "jpeg", return_base64: true,
    prompt: "Preserve the person's identity, facial features, body shape, pose and original background. Change only the selected garment.",
  } : {
    model_image: person, garment_image: garment, category: categories[category],
    mode: "quality", segmentation_free: true, garment_photo_type: "auto",
    moderation_level: "permissive", num_samples: 1, output_format: "jpeg", return_base64: true,
  };
  const result = await providerJSON("/run", { model_name: model, inputs });
  if (result.error || typeof result.id !== "string" || !/^[a-zA-Z0-9_-]{10,120}$/.test(result.id))
    throw new AppError(502, "The AI service could not start this preview.");
  return result.id;
}
export async function predictionStatus(id: string) {
  const result = await providerJSON("/status/" + encodeURIComponent(id));
  if (result.status === "failed") {
    const name = (result.error as { name?: string } | null)?.name;
    const message = name === "PoseError"
      ? "Use a well-lit, full-body photo with your arms slightly away from your body."
      : "This preview could not be created. Please try a clearer photo.";
    return { status: "failed" as const, error: message };
  }
  if (result.status === "completed") {
    const output = Array.isArray(result.output) ? result.output[0] : undefined;
    if (typeof output !== "string" || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(output))
      throw new AppError(502, "This preview has expired or could not be retrieved. Please try again.");
    return { status: "completed" as const, image: output };
  }
  if (!["starting", "in_queue", "processing"].includes(String(result.status)))
    throw new AppError(502, "The AI service returned an unexpected status.");
  return { status: "processing" as const };
}
