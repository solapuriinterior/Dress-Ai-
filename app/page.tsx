import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
export default function Home() {
  return <><SiteHeader /><main className="container">
    <section className="home-hero">
      <div><p className="eyebrow">A fitting room for your online shop</p><h1>Your catalogue.<br />Their next <em>look.</em></h1>
        <p className="lead">Turn the clothes you already sell into personal AI previews. One customer photo. Your own garments. A new way to explore an outfit.</p>
        <div className="actions"><Link className="button" href="/dashboard">Set up your shop <span aria-hidden="true">↗</span></Link><Link className="button secondary" href="/tryon">Open try-on studio</Link></div>
        <div className="hero-notes"><span>Reuse your catalogue</span><span>Mobile & desktop</span><span>Share or embed</span></div>
      </div>
      <div className="hero-visual" aria-label="Illustration of an online fitting room">
        <div className="visual-caption"><span className="live-dot" />Your fitting room, online<span>01 / 03</span></div>
        <div className="visual-shirt"><svg viewBox="0 0 240 270" role="img" aria-label="Garment illustration"><path d="M70 30 30 50 10 113 60 125 65 235 175 235 180 125 230 113 210 50 170 30 150 47H90Z" fill="#2a7169" stroke="#174a45" strokeWidth="2"/><path d="m70 30 38 28-18 31-27-23m107-36-38 28 18 31 27-23M120 60v174" fill="none" stroke="#b2ccc0" strokeWidth="2"/><circle cx="126" cy="110" r="2" fill="#cdded3"/><circle cx="126" cy="144" r="2" fill="#cdded3"/><circle cx="126" cy="178" r="2" fill="#cdded3"/></svg></div>
        <div className="visual-tag"><span className="eyebrow">Made for your catalogue</span><strong>Keep the garment.<br />Explore the look.</strong></div>
        <div className="visual-step"><span>1</span>Upload a photo <span>2</span>Choose a garment <span>3</span>Create a preview</div>
      </div>
    </section>
    <section className="feature-grid" aria-label="How Dress AI works">
      <article><span className="step-number">01</span><h2>Your garments, once</h2><p>Upload images, set prices and organise your collection. Customers choose from that same catalogue.</p></article>
      <article><span className="step-number">02</span><h2>A personal preview</h2><p>A clear full-body photo and one selected garment become an AI outfit preview, with permission.</p></article>
      <article><span className="step-number">03</span><h2>A shop that travels</h2><p>Share your shop link or add the fitting room to your existing website. Price garments in your preferred currency.</p></article>
    </section>
  </main><footer className="site-footer"><span>Dress AI · An outfit preview, made personal.</span><Link href="/privacy">Photo privacy</Link></footer></>;
}
