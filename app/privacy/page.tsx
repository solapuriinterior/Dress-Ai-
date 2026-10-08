import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
export default function Privacy() {
  return <><SiteHeader /><main className="container policy"><p className="eyebrow">Photo privacy</p><h1>Your photo. Your choice.</h1>
    <section className="panel"><h2>Before you create a preview</h2><p>Your selected photo stays on your device until you confirm permission and tap Create outfit preview. You should use your own photo or have permission from the person pictured.</p>
      <h2>How the preview is processed</h2><p>Dress AI removes image metadata and sends the customer photo to FASHN as image data, together with the selected garment. We do not save customer photos or generated previews in our public garment catalogue. FASHN processes the images to create the outfit preview.</p>
      <h2>Temporary results and request records</h2><p>We request image-data results rather than public result links. FASHN makes these results available for up to 60 minutes. Its request metadata is not automatically deleted, and temporary input processing copies may remain until its cleanup finishes. See <a href="https://docs.fashn.ai/api-overview/data-retention-privacy" target="_blank" rel="noreferrer">FASHN’s data retention policy</a> for the current details.</p>
      <p>Dress AI keeps request IDs, shop/product references, timestamps, status and hashed access/rate-limit identifiers to track usage and protect the service. These records contain no customer photo or preview image.</p>
      <h2>Clear or download your preview</h2><p>Download a result you want to keep. Clear photo & result removes it from this page and requests that Dress AI revoke result retrieval access. It does not delete FASHN’s request records or cancel an already-running prediction. Contact the shop for account or data requests; FASHN describes requests for deletion of its records in the linked policy.</p>
      <h2>Garment images and accounts</h2><p>Garment images and published catalogue details are public so customers can browse the shop. Shop account access and editing are protected by sign-in and ownership permissions.</p>
      <Link className="button secondary" href="/tryon">Back to try-on studio</Link>
    </section></main></>;
}
