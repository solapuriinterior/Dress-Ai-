"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

export default function Upload() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  async function sendToAI() {
    if (!photo) {
      alert("Please upload your photo");
      return;
    }

    setLoading(true);
    setMessage("");

    const response = await fetch("/api/tryon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        photo: photo.name,
        dress: "not-selected",
      }),
    });

    const data = await response.json();

    setLoading(false);

    if (data.success) {
      setMessage("✅ AI Request Sent Successfully");
    } else {
      setMessage("❌ Failed");
    }
  }

  return (
    <section className="max-w-md mx-auto bg-zinc-900 rounded-xl p-6 mt-12">
      <h2 className="text-3xl font-bold text-center mb-6">
        Upload Your Photo
      </h2>

      <input
        type="file"
        accept="image/*"
        onChange={handlePhoto}
        className="w-full mb-5"
      />

      {preview && (
        <img
          src={preview}
          alt="Preview"
          className="w-56 h-72 object-cover rounded-lg mx-auto"
        />
      )}

      <button
        onClick={sendToAI}
        className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg py-4 mt-6 text-xl"
      >
        {loading ? "Processing..." : "Continue"}
      </button>

      {message && (
        <p className="text-center mt-5 text-green-400">
          {message}
        </p>
      )}
    </section>
  );
}
