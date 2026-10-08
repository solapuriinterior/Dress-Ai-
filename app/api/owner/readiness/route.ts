import { authenticatedUser } from "@/lib/server/database";
import { failure, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await authenticatedUser(request);
    const ai = Boolean(process.env.FASHN_API_KEY);
    const privateAccess = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
    return json({ ready: ai && privateAccess, aiConfigured: ai, privateAccessConfigured: privateAccess,
      publicPreviews: process.env.PUBLIC_TRYON_ENABLED === "true",
      note: "Configured credentials still need a successful real preview to confirm account credits and output quality.",
    });
  } catch (error) { return failure(error); }
}
