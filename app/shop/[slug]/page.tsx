import SiteHeader from "@/components/SiteHeader";
import TryOnStudio from "@/components/TryOnStudio";
export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <><SiteHeader /><TryOnStudio slug={slug} /></>;
}
