export default function Header() {
  return (
    <header className="w-full bg-black border-b border-gray-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between p-5">

        <h1 className="text-2xl font-bold text-blue-500">
          Dress AI
        </h1>

        <nav className="flex gap-6 text-white">

          <a href="#">Home</a>

          <a href="#">Gallery</a>

          <a href="#">Pricing</a>

          <a href="#">Login</a>

        </nav>

      </div>
    </header>
  );
}
