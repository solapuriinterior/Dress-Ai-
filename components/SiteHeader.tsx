import Link from "next/link";
export default function SiteHeader() {
  return <header className="site-header"><Link href="/" className="brand"><span className="brand-mark">D</span>Dress<span className="brand-light">AI</span></Link>
    <nav aria-label="Main navigation"><Link href="/tryon">Try-on studio</Link><Link href="/dashboard" className="button small">Shop dashboard <span aria-hidden="true">↗</span></Link></nav>
  </header>;
}
