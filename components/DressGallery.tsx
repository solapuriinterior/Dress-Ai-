"use client";

const dresses = [
  {
    id: 1,
    name: "Red Dress",
    image: "https://picsum.photos/300/400?random=1",
  },
  {
    id: 2,
    name: "Blue Dress",
    image: "https://picsum.photos/300/400?random=2",
  },
  {
    id: 3,
    name: "Black Dress",
    image: "https://picsum.photos/300/400?random=3",
  },
  {
    id: 4,
    name: "White Dress",
    image: "https://picsum.photos/300/400?random=4",
  },
];

export default function DressGallery() {
  return (
    <section className="max-w-6xl mx-auto py-16 px-5">
      <h2 className="text-4xl font-bold text-center mb-10">
        Choose Your Dress
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {dresses.map((dress) => (
          <div
            key={dress.id}
            className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700 hover:border-blue-500 transition"
          >
            <img
              src={dress.image}
              alt={dress.name}
              className="w-full h-72 object-cover"
            />

            <div className="p-4">
              <h3 className="text-lg font-semibold">{dress.name}</h3>

              <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg">
                Select
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
