"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { authHeaders, getSupabase, hasPublicConfig } from "@/lib/supabase";
import { currencies, categoryLabels, formatPrice, productColumns, type Category, type Currency, type Product, type Shop } from "@/lib/catalogue";
import { prepareImage } from "@/lib/photo-client";
type Readiness = { ready: boolean; aiConfigured: boolean; privateAccessConfigured: boolean; publicPreviews: boolean };
export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState("");
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState({ attempts: 0, completed: 0 });
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      if (!hasPublicConfig()) throw new Error("Shop services are being set up. Please try again later.");
      const client = getSupabase();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user || user.is_anonymous) { router.replace("/login"); return; }
      setUserId(user.id); setOrigin(window.location.origin);
      const { data: ownedShop, error: shopError } = await client.from("dress_ai_shops")
        .select("id,owner_id,name,slug,currency").eq("owner_id", user.id).maybeSingle();
      if (shopError) throw shopError;
      setShop(ownedShop as Shop | null);
      if (ownedShop) {
        const { data, error } = await client.from("dress_ai_products").select(productColumns)
          .eq("owner_id", user.id).eq("shop_id", ownedShop.id).order("created_at", { ascending: false });
        if (error) throw error; setProducts((data || []) as Product[]);
        const since = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: jobs, error: jobsError } = await client.from("dress_ai_jobs")
          .select("id,status").eq("shop_id", ownedShop.id).gte("created_at", since).limit(1000);
        if (jobsError) throw jobsError;
        setStats({ attempts: jobs?.length || 0, completed: jobs?.filter(j => j.status === "completed").length || 0 });
      }
      const response = await fetch("/api/owner/readiness", { headers: await authHeaders(), cache: "no-store" });
      if (response.ok) setReadiness(await response.json());
    } catch (error) { setError(error instanceof Error ? error.message : "Your shop could not be loaded."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function createShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const slug = String(form.get("slug") || "").trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) throw new Error("Use 3–60 lowercase letters, numbers or hyphens for your shop link.");
      const { error } = await getSupabase().from("dress_ai_shops").insert({
        owner_id: userId, name: String(form.get("name")).trim(), slug, currency: String(form.get("currency")),
      });
      if (error) throw new Error(error.code === "23505" ? "That shop link is already taken. Please choose another." : error.message);
      await load(); setMessage("Your shop is ready. Add your first garment below.");
    } catch (error) { setError(error instanceof Error ? error.message : "Your shop could not be created."); }
    finally { setBusy(false); }
  }
  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!shop) return;
    const element = event.currentTarget;
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(element);
    let uploadedPath: string | null = null;
    try {
      const source = form.get("image");
      if (!(source instanceof File) || !source.size) throw new Error("Choose a garment photo.");
      const image = await prepareImage(source);
      const path = userId + "/" + crypto.randomUUID() + ".jpg";
      const client = getSupabase();
      const { error: uploadError } = await client.storage.from("dress-ai-catalogue").upload(path, image, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      uploadedPath = path;
      const { error } = await client.from("dress_ai_products").insert({
        owner_id: userId, shop_id: shop.id, name: String(form.get("name")).trim(),
        price: Number(form.get("price")), currency: shop.currency,
        category: String(form.get("category")), storage_path: path,
        image: client.storage.from("dress-ai-catalogue").getPublicUrl(path).data.publicUrl,
      });
      if (error) throw error;
      uploadedPath = null; element.reset(); await load(); setMessage("Garment added to your catalogue.");
    } catch (error) {
      if (uploadedPath) await getSupabase().storage.from("dress-ai-catalogue").remove([uploadedPath]);
      setError(error instanceof Error ? error.message : "The garment could not be uploaded.");
    } finally { setBusy(false); }
  }
  async function updateProduct(event: FormEvent<HTMLFormElement>, product: Product) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const { error } = await getSupabase().from("dress_ai_products").update({
        name: String(form.get("name")).trim(), price: Number(form.get("price")),
        category: String(form.get("category")), active: form.get("active") === "on",
      }).eq("id", product.id).eq("owner_id", userId);
      if (error) throw error; setEditing(null); await load(); setMessage("Garment updated.");
    } catch (error) { setError(error instanceof Error ? error.message : "The garment could not be updated."); }
    finally { setBusy(false); }
  }
  async function removeProduct(product: Product) {
    if (!window.confirm("Remove " + product.name + " from your catalogue?")) return;
    setBusy(true); setError("");
    try {
      const client = getSupabase();
      const { error } = await client.from("dress_ai_products").delete().eq("id", product.id).eq("owner_id", userId);
      if (error) throw error;
      const { error: storageError } = await client.storage.from("dress-ai-catalogue").remove([product.storage_path]);
      await load();
      setMessage(storageError ? "Garment removed. Image cleanup needs another attempt." : "Garment removed.");
    } catch (error) { setError(error instanceof Error ? error.message : "The garment could not be removed."); }
    finally { setBusy(false); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage("Copied to clipboard."); }
    catch { setError("Please select and copy the text manually."); }
  }
  async function signOut() { await getSupabase().auth.signOut(); router.replace("/login"); }
  const shopUrl = shop ? origin + "/shop/" + shop.slug : "";
  const embedCode = shop ? '<iframe src="' + origin + "/embed/" + shop.slug + '" title="Dress AI virtual try-on" width="100%" height="1050" style="border:0;border-radius:16px" loading="lazy"></iframe>' : "";
  return <><SiteHeader /><main className="container dashboard">
    <div className="page-heading"><div><p className="eyebrow">Your shop workspace</p><h1>{shop?.name || "Shop dashboard"}</h1><p className="muted">Manage the collection. Share the fitting room.</p></div>{userId && <button className="button secondary small" onClick={signOut}>Sign out</button>}</div>
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    {loading ? <div className="panel loading-state" role="status">Loading your shop…</div> : !userId ? <div className="panel"><p>Sign in to manage your shop.</p><Link className="button" href="/login">Sign in</Link></div> : !shop ? <section className="panel setup-panel"><p className="eyebrow">Your first step</p><h2>Create your shop</h2><p className="muted">Choose a name and a link customers can remember.</p><form onSubmit={createShop}>
      <label>Shop name<input name="name" required maxLength={100} placeholder="Your shop name" /></label>
      <label>Shop link<input name="slug" required minLength={3} maxLength={60} pattern="[a-z0-9][a-z0-9-]{2,59}" placeholder="your-shop" /><span className="field-hint">{origin}/shop/your-shop</span></label>
      <label>Catalogue currency<select name="currency" defaultValue="INR">{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
      <button className="button" disabled={busy}>{busy ? "Creating…" : "Create shop"}</button></form></section> : <>
      <section className="stats-grid"><div className="stat"><span>Garments</span><strong>{products.length}</strong><small>{products.filter(p => p.active).length} visible to customers</small></div><div className="stat"><span>Preview attempts</span><strong>{stats.attempts}</strong><small>Last 7 days</small></div><div className="stat"><span>Completed previews</span><strong>{stats.completed}</strong><small>Last 7 days</small></div><div className="stat"><span>Fitting room</span><strong className="stat-status">{readiness?.ready ? "Ready" : "Paused"}</strong><small>{readiness?.ready ? readiness.publicPreviews ? "Customer previews enabled" : "Owner preview available" : "Catalogue remains available"}</small></div></section>
      <div className="dashboard-grid"><section className="panel"><div className="section-heading"><h2>Add a garment</h2><span className="pill">Upload once</span></div><form onSubmit={addProduct}>
        <label>Garment name<input name="name" required maxLength={120} placeholder="e.g. Navy cotton shirt" /></label>
        <div className="two-fields"><label>Price ({shop.currency})<input name="price" type="number" required min="0" max="10000000" step="0.01" placeholder="0.00" /></label><label>Garment type<select name="category" defaultValue="upper_body">{Object.entries(categoryLabels).map(([k,v]) => <option value={k} key={k}>{v}</option>)}</select></label></div>
        <label className="upload-box">Garment photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /><span className="field-hint">A clear front view. JPG, PNG or WebP, up to 12 MB.</span></label>
        <button className="button full" disabled={busy}>{busy ? "Please wait…" : "Add to catalogue"}</button></form></section>
      <section className="panel sharing-panel"><p className="eyebrow">Let customers explore</p><h2>Your fitting room, anywhere.</h2><p className="muted">Share your shop link or add this fitting room to your website.</p><label>Shop link<div className="copy-row"><input readOnly value={shopUrl} /><button className="button small secondary" onClick={() => copy(shopUrl)}>Copy</button></div></label>
        <div className="actions"><Link className="button secondary small" href={"/shop/" + shop.slug} target="_blank">Open shop ↗</Link><Link className="button small" href="/tryon">Open owner studio</Link></div>
        <details><summary>Embed on your website</summary><textarea readOnly rows={4} value={embedCode} aria-label="Embed code" /><button className="text-button" onClick={() => copy(embedCode)}>Copy embed code</button></details>
        <details><summary>Preview service status</summary><ul className="status-list"><li>AI connection: {readiness?.aiConfigured ? "Configured" : "Needs setup"}</li><li>Private processing access: {readiness?.privateAccessConfigured ? "Configured" : "Needs setup"}</li><li>Public customer previews: {readiness?.publicPreviews ? "Enabled" : "Paused"}</li></ul><p className="field-hint">A real preview confirms that credits and image quality are ready.</p></details>
      </section></div>
      <section className="catalogue-section"><div className="section-heading"><div><p className="eyebrow">Your collection</p><h2>Garment catalogue</h2></div><span className="pill">{products.length} garments</span></div>
        {!products.length ? <div className="empty-state panel"><span aria-hidden="true">＋</span><h3>Your first garment starts here.</h3><p>Add a photo above. Customers will use the same catalogue for their previews.</p></div> : <div className="product-grid">{products.map(product => <article className="product-card" key={product.id}>
          <img src={product.image} alt={product.name} loading="lazy" className="product-image" /><div className="product-info">{editing === product.id ? <form onSubmit={event => updateProduct(event, product)}><label>Name<input name="name" defaultValue={product.name} required maxLength={120} /></label><label>Price ({product.currency})<input name="price" type="number" min="0" step="0.01" defaultValue={product.price} required /></label><label>Garment type<select name="category" defaultValue={product.category}>{Object.entries(categoryLabels).map(([k,v]) => <option value={k} key={k}>{v}</option>)}</select></label><label className="check-row"><input name="active" type="checkbox" defaultChecked={product.active} />Visible to customers</label><div className="actions"><button className="button small" disabled={busy}>Save</button><button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button></div></form> : <><p className="eyebrow">{categoryLabels[product.category as Category]}</p><h3>{product.name}</h3><p className="product-price">{formatPrice(Number(product.price), product.currency as Currency)}</p>{!product.active && <span className="pill">Hidden</span>}<div className="card-actions"><button className="text-button" onClick={() => setEditing(product.id)} disabled={busy}>Edit</button><button className="text-button danger" onClick={() => removeProduct(product)} disabled={busy}>Remove</button></div></>}</div></article>)}</div>}
      </section>
    </>}
  </main></>;
}
