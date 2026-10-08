"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authHeaders, getSupabase } from "@/lib/supabase";
import { categoryLabels, formatPrice, productColumns, type Product, type Shop, type Category } from "@/lib/catalogue";
import { prepareImage } from "@/lib/photo-client";
type Item = Pick<Product, "id" | "shop_id" | "name" | "price" | "currency" | "image" | "category">;
type Capability = { requestId: string; token: string };
export default function TryOnStudio({ slug, embedded = false }: { slug?: string; embedded?: boolean }) {
  const [shop, setShop] = useState<Pick<Shop, "id" | "name" | "slug" | "currency"> | null>(null);
  const [products, setProducts] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [result, setResult] = useState("");
  const [resultName, setResultName] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewsEnabled, setPreviewsEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [canResume, setCanResume] = useState(false);
  const urlRef = useRef("");
  const capability = useRef<Capability | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const load = useCallback(async () => {
    try {
      if (slug) {
        const response = await fetch("/api/shop/" + encodeURIComponent(slug), { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "The shop could not be loaded.");
        setShop(data.shop); setProducts(data.products); setPreviewsEnabled(data.previewsEnabled);
      } else {
        const client = getSupabase();
        const { data: { user }, error: authError } = await client.auth.getUser();
        if (authError || !user) throw new Error("Sign in to open your shop's try-on studio.");
        const { data: owned, error } = await client.from("dress_ai_shops").select("id,name,slug,currency").eq("owner_id", user.id).maybeSingle();
        if (error) throw error;
        if (!owned) throw new Error("Create your shop from the dashboard first.");
        setShop(owned);
        const { data, error: productError } = await client.from("dress_ai_products").select(productColumns)
          .eq("shop_id", owned.id).eq("owner_id", user.id).eq("active", true).order("created_at", { ascending: false });
        if (productError) throw productError; setProducts(data || []);
        const response = await fetch("/api/owner/readiness", { headers: await authHeaders(), cache: "no-store" });
        if (response.ok) setPreviewsEnabled((await response.json()).ready);
      }
    } catch (error) { setError(error instanceof Error ? error.message : "The catalogue could not be loaded."); }
    finally { setLoading(false); }
  }, [slug]);
  useEffect(() => { void Promise.resolve().then(load); return () => { abortRef.current?.abort(); if (urlRef.current) URL.revokeObjectURL(urlRef.current); }; }, [load]);
  async function choosePhoto(source: File | undefined) {
    if (!source) return;
    setPreparing(true); setError("");
    try {
      const prepared = await prepareImage(source);
      const previous = capability.current; capability.current = null;
      if (previous) void fetch("/api/tryon/" + previous.requestId, { method: "DELETE", headers: { "X-Tryon-Token": previous.token } }).catch(() => {});
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(prepared); urlRef.current = url;
      setFile(prepared); setPhotoUrl(url); setResult(""); setResultName(""); setConsent(false); setCanResume(false);
    } catch (error) { setError(error instanceof Error ? error.message : "The photo could not be opened."); }
    finally { setPreparing(false); }
  }
  async function poll(current: Capability, controller: AbortController) {
    const deadline = Date.now() + 120000;
    while (!controller.signal.aborted && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (controller.signal.aborted) return;
      const response = await fetch("/api/tryon/" + current.requestId, {
        headers: { "X-Tryon-Token": current.token }, cache: "no-store", signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if ([502,503,504,429].includes(response.status)) continue;
        capability.current = null;
        throw new Error(data.error || "The preview could not be retrieved.");
      }
      if (data.status === "completed") { setResult(data.image); setProgress("Your preview is ready."); setCanResume(false); return; }
      if (data.status === "failed") { capability.current = null; throw new Error(data.error || "This preview could not be created."); }
      setProgress("Creating your outfit preview…");
    }
    if (!controller.signal.aborted) { setCanResume(true); throw new Error("Your preview is taking longer. Check it again below without starting another request."); }
  }
  async function createPreview(resume = false) {
    if (!resume && (!file || !selected || !consent)) { setError("Choose a photo and garment, then confirm permission to continue."); return; }
    setBusy(true); setError(""); setCanResume(false);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      let current = capability.current;
      if (!resume) {
        const previous = capability.current; capability.current = null;
        if (previous) void fetch("/api/tryon/" + previous.requestId, { method: "DELETE", headers: { "X-Tryon-Token": previous.token } }).catch(() => {});
        setResult(""); setResultName(selected!.name); setProgress("Sending your photo securely…");
        const form = new FormData(); form.set("personImage", file!); form.set("productId", selected!.id); form.set("consent", "true");
        const response = await fetch("/api/tryon", { method: "POST", headers: slug ? {} : await authHeaders(), body: form, signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "The preview could not be started.");
        current = { requestId: data.requestId, token: data.token }; capability.current = current;
      }
      if (current) await poll(current, controller);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : "The preview could not be completed.");
        setProgress(capability.current ? "Your preview is pending. Check it again below." : "");
        if (capability.current) setCanResume(true);
      }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function clear() {
    abortRef.current?.abort(); setBusy(false); setError(""); setProgress(""); setCanResume(false);
    const current = capability.current; capability.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = "";
    setFile(null); setPhotoUrl(""); setResult(""); setConsent(false);
    if (inputRef.current) inputRef.current.value = "";
    if (current) {
      try { await fetch("/api/tryon/" + current.requestId, { method: "DELETE", headers: { "X-Tryon-Token": current.token } }); }
      catch { /* Local photo and result have already been cleared. The access token expires automatically. */ }
    }
  }
  const visible = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && (category === "all" || p.category === category));
  return <main className={embedded ? "studio embedded" : "container studio"}>
    <div className="page-heading"><div><p className="eyebrow">{slug ? "Your online fitting room" : "Owner preview studio"}</p><h1>{shop?.name || "Try-on studio"}</h1><p className="muted">Choose a garment. Upload a full-body photo. Explore the look.</p></div>{!slug && <Link href="/dashboard" className="button secondary small">Back to dashboard</Link>}</div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {loading ? <div className="panel loading-state" role="status">Loading the collection…</div> : <>
      {!shop && !slug && <Link className="button" href="/login">Sign in</Link>}
      {shop && !previewsEnabled && <p className="notice">AI previews are paused for now. You can browse the collection below.</p>}
      <div className="studio-grid"><section className="panel photo-panel"><div className="section-heading"><h2><span className="step-badge">1</span>Your photo</h2>{photoUrl && <button className="text-button" onClick={clear}>Clear photo & result</button>}</div>
        <label className={"photo-drop " + (photoUrl ? "has-photo" : "")}>{photoUrl ? <img src={photoUrl} alt="Your uploaded photo" /> : <><span className="photo-icon" aria-hidden="true">＋</span><strong>Choose a full-body photo</strong><span>Good light, a clear pose, and your whole outfit in view.</span></>}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Customer photo" disabled={busy || preparing} onChange={e => choosePhoto(e.target.files?.[0])} /><span className="photo-change">{preparing ? "Preparing photo…" : photoUrl ? "Change photo" : "Browse photos"}</span>
        </label><p className="field-hint">JPG, PNG or WebP, up to 12 MB. The photo is prepared on your device before sending.</p>
        <label className="check-row consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} /><span>I own this photo or have permission to use it. I agree to send it to FASHN for an AI outfit preview. <Link href="/privacy" target="_blank">Photo privacy ↗</Link></span></label>
        <button className="button full" onClick={() => createPreview(false)} disabled={!file || !selected || !consent || busy || preparing || !previewsEnabled || canResume}>{busy ? "Creating preview…" : "Create outfit preview"}</button>
        {progress && <p className="progress" role="status">{busy && <span className="spinner" aria-hidden="true" />}{progress}</p>}
        {canResume && <button className="button secondary full" onClick={() => createPreview(true)} disabled={busy}>Check existing preview</button>}
        {selected && <p className="selected-note">Selected: <strong>{selected.name}</strong></p>}
      </section><section className="collection-panel"><div className="section-heading"><h2><span className="step-badge">2</span>Choose a garment</h2><span className="pill">{products.length} pieces</span></div>
        <div className="catalogue-filters"><label className="sr-only" htmlFor="garment-search">Search garments</label><input id="garment-search" type="search" placeholder="Search the collection" value={search} onChange={e => setSearch(e.target.value)} /><label className="sr-only" htmlFor="garment-category">Garment type</label><select id="garment-category" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All garments</option>{Object.entries(categoryLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        {!visible.length ? <div className="panel empty-state"><h3>{products.length ? "No matching garments." : "The collection is on its way."}</h3><p>{products.length ? "Try another search or garment type." : "Add garments from the shop dashboard to get started."}</p></div> : <div className="selection-grid">{visible.map(product => <button key={product.id} className={"selection-card " + (selected?.id === product.id ? "selected" : "")} aria-pressed={selected?.id === product.id} disabled={busy} onClick={() => { setSelected(product); setError(""); }}><div className="selection-image"><img src={product.image} alt={product.name} loading="lazy" />{selected?.id === product.id && <span className="selection-check" aria-hidden="true">✓</span>}</div><div className="selection-info"><span>{categoryLabels[product.category as Category]}</span><strong>{product.name}</strong><p>{formatPrice(Number(product.price), product.currency)}</p></div></button>)}</div>}
      </section></div>
      {result && <section className="panel result-panel"><div className="section-heading"><div><p className="eyebrow">A new perspective</p><h2>Your outfit preview</h2></div><a className="button small" href={result} download="dress-ai-preview.jpg">Download preview ↓</a></div><div className="comparison"><figure><img src={photoUrl} alt="Your original photo" /><figcaption>Your photo</figcaption></figure><figure><img src={result} alt="AI outfit preview" /><figcaption>{resultName || "AI outfit preview"}</figcaption></figure></div><p className="field-hint">This is an AI visual preview. Actual fit, sizing and garment details can vary. Download it before leaving this page.</p></section>}
    </>}
  </main>;
}
