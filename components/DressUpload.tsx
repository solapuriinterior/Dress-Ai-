"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DressUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  async function uploadDress() {
    if (!file || !name) {
      alert("Select image and enter dress name");
      return;
    }

    const fileName = `${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("dresses")
      .upload(fileName, file);

    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("dresses").getPublicUrl(fileName);

    const { error } = await supabase.from("dresses").insert({
      name,
      image: publicUrl,
      price: Number(price),
    });

if (error) {
  console.log(error);
  alert(JSON.stringify(error, null, 2));
  return;
}

    alert("Dress Uploaded Successfully");
    setFile(null);
    setName("");
    setPrice("");
  }

  return (
    <div className="bg-zinc-900 p-6 rounded-xl mt-8">
      <input
        type="text"
        placeholder="Dress Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-3 rounded bg-zinc-800 mb-3"
      />

      <input
        type="number"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-full p-3 rounded bg-zinc-800 mb-3"
      />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-4"
      />

      <button
        onClick={uploadDress}
        className="w-full bg-blue-600 py-3 rounded-lg"
      >
        Upload Dress
      </button>
    </div>
  );
}
