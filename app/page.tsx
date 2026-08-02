export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold text-blue-500">
        Dress AI
      </h1>

      <p className="mt-4 text-lg text-gray-300">
        AI Virtual Try-On Platform
      </p>

      <button className="mt-8 px-6 py-3 bg-blue-600 rounded-xl">
        Start Try-On
      </button>
    </main>
  );
}

