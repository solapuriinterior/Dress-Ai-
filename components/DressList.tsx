"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DressList() {
  const [dresses, setDresses] = useState<{ id: number; name: string; image: string; price: number }[]>([]);

  async function loadDresses() {
    const { data } = await supabase
      .from("dresses")
      .select("*")
      .order("id", { ascending: false });

    if (data) setDresses(data);
  }

  useEffect(() => {
    void Promise.resolve().then(loadDresses);
  }, []);



async function deleteDress(id: number, image: string) {
  if (!confirm("Delete this dress?")) return;

  const fileName = image.split("/").pop();

  if (fileName) {
    await supabase.storage
      .from("dresses")
      .remove([fileName]);
  }

  await supabase
    .from("dresses")
    .delete()
    .eq("id", id);

  loadDresses();
}
  return (
    <div className="mt-10">
      <h2 className="text-2xl font-bold mb-5">Uploaded Dresses</h2>

      <div className="grid grid-cols-2 gap-4">
        {dresses.map((dress) => (
          <div
            key={dress.id}
            className="bg-zinc-900 rounded-xl p-3"
          >
            <img
              src={dress.image}
              alt={dress.name}
              className="rounded-lg w-full h-48 object-cover"
            />

<h3 className="mt-3 text-lg font-bold text-white">
  {dress.name}
</h3>

<p className="text-green-400 text-xl font-bold mt-1">
  ₹ {dress.price}
</p>
<button
  onClick={() => deleteDress(dress.id, dress.image)}
  className="w-full mt-3 bg-red-600 rounded-lg py-2"
>
  Delete
</button> 
     </div>
    ))}
  </div>
</div>
  );
}
