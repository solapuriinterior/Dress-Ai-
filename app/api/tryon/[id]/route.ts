import { authorizedJob } from "@/lib/server/jobs";
import { predictionStatus } from "@/lib/server/fashn";
import { AppError, failure, imageResult, json, sameOrigin } from "@/lib/server/http";
export const runtime = "nodejs";
export const maxDuration = 30;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { database, job } = await authorizedJob(request, id);
    if (!job.provider_id || job.status === "failed") return json({ status: "failed", error: "This preview could not be created." });
    const result = await predictionStatus(job.provider_id);
    if (result.status !== "processing" && result.status !== job.status) {
      const { error } = await database.from("dress_ai_jobs").update({ status: result.status }).eq("id", id);
      if (error) throw new AppError(503, "Preview tracking is temporarily unavailable.");
    }
    return result.status === "completed" ? imageResult(result) : json(result);
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const { id } = await context.params;
    const { database } = await authorizedJob(request, id);
    // Invalidate retrieval access without deleting the usage record used for daily limits.
    const { error } = await database.from("dress_ai_jobs").update({
      token_hash: "0".repeat(64), expires_at: new Date(0).toISOString(),
    }).eq("id", id);
    if (error) throw new AppError(503, "Preview access could not be cleared. Please try again.");
    return json({ cleared: true });
  } catch (error) { return failure(error); }
}
