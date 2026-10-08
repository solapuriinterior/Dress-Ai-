import TryOnStudio from "@/components/TryOnStudio";
export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TryOnStudio slug={slug} embedded />;
}
