import Header from "../components/Header";
import Hero from "../components/Hero";
import Upload from "../components/Upload";
import DressGallery from "../components/DressGallery";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Header />
      <Hero />
      <Upload />
      <DressGallery />
    </main>
  );
}
