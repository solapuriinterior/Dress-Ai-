import DressUpload from "@/components/DressUpload";
import DressList from "@/components/DressList";
export default function Dashboard() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-4xl font-bold text-center text-blue-500">
        Shop Owner Dashboard
      </h1>

      <p className="text-center text-gray-400 mt-2">
        AI Virtual Try-On Management Panel
      </p>

      <div className="grid grid-cols-2 gap-4 mt-10">
        <div className="bg-zinc-900 rounded-xl p-5">
          <h2 className="text-xl font-bold">👗 Dresses</h2>
          <p className="text-4xl mt-3">0</p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5">
          <h2 className="text-xl font-bold">👥 Customers</h2>
          <p className="text-4xl mt-3">0</p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5">
          <h2 className="text-xl font-bold">📸 Try-On</h2>
          <p className="text-4xl mt-3">0</p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5">
          <h2 className="text-xl font-bold">⭐ Premium</h2>
          <p className="text-3xl mt-3 text-green-400">Active</p>
        </div>
      </div>

      <button className="w-full mt-10 bg-blue-600 hover:bg-blue-700 rounded-xl py-4 text-xl font-bold">
        Upload New Dress
      </button>
<DressUpload />
<DressList />
    </main>
  );
}
