import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Dress AI · See your next look", template: "%s · Dress AI" },
  description: "Create AI outfit previews from a shop's own catalogue. Manage garments, share your shop and let customers explore their next look.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
