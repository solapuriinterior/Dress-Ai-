"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Dress = {
  id: number;
  name: string;
  image: string;
  price: number | null;
};

export default function TryOnPage() {
  const [personImage, setPersonImage] = useState<File | null>(null);
  const [dresses, setDresses] = useState<Dress[]>([]);
  const [selectedDress, setSelectedDress] = useState<Dress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDresses();
  }, []);

  async function loadDresses() {
    setLoading(true);

    const { data, error } = await supabase
      .from("dresses")
      .select("id, name, image, price")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setDresses(data || []);
    setLoading(false);
  }

  function handleTryOn() {
    if (!personImage) {
      alert("Please upload customer photo");
      return;
    }

    if (!selectedDress) {
      alert("Please select a dress");
      return;
    }

    alert(
      `Customer photo and ${selectedDress.name} selected successfully`
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-4xl font-bold text-center mt-6">
        Dress AI Try-On
      </h1>

      <div className="max-w-xl mx-auto mt-10">
        <label className="block text-xl font-semibold mb-3">
          Upload Customer Photo
        </label>

        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setPersonImage(e.target.files?.[0] || null)
          }
          className="w-full bg-zinc-900 p-5 rounded-xl"
        />

        <h2 className="text-3xl font-bold mt-10 mb-5">
          Select Dress
        </h2>

        {loading ? (
          <p className="text-gray-400">Loading dresses...</p>
        ) : dresses.length === 0 ? (
          <p className="text-gray-400">No dresses uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {dresses.map((dress) => (
              <button
                type="button"
                key={dress.id}
                onClick={() => setSelectedDress(dress)}
                className={`rounded-xl overflow-hidden border-4 text-left ${
                  selectedDress?.id === dress.id
                    ? "border-blue-500"
                    : "border-transparent"
                }`}
              >
                <img
                  src={dress.image}
                  alt={dress.name}
                  className="w-full h-52 object-cover"
                />

                <div className="bg-zinc-900 p-3">
                  <p className="font-bold">{dress.name}</p>

                  {dress.price !== null && (
                    <p className="text-gray-300">
                      ₹{dress.price}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleTryOn}
          className="w-full bg-blue-600 py-4 rounded-xl text-xl font-bold mt-8"
        >
          Try On
        </button>
      </div>
    </main>
  );
}
