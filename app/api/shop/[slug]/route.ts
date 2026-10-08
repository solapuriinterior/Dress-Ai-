import { publicDatabase } from "@/lib/server/database";
import { AppError, failure, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) throw new AppError(404, "Shop not found.");
    const database = publicDatabase();
    const { data: shop, error } = await database.from("dress_ai_shops").select("id,name,slug,currency").eq("slug", slug).maybeSingle();
    if (error) throw new AppError(503, "The shop could not be loaded. Please try again.");
    if (!shop) throw new AppError(404, "Shop not found.");
    const { data: products, error: productError } = await database.from("dress_ai_products")
      .select("id,shop_id,name,price,currency,image,category").eq("shop_id", shop.id)
      .eq("active", true).order("created_at", { ascending: false }).limit(1000);
    if (productError) throw new AppError(503, "The catalogue could not be loaded. Please try again.");
    return json({ shop, products: products || [], previewsEnabled:
      process.env.PUBLIC_TRYON_ENABLED === "true" && Boolean(process.env.FASHN_API_KEY) &&
      Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) });
  } catch (error) { return failure(error); }
}
