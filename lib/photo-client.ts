export async function prepareImage(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG or WebP photo.");
  if (file.size > 12_000_000) throw new Error("Choose a photo under 12 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 256 || bitmap.height < 256 || bitmap.width * bitmap.height > 25_000_000)
      throw new Error("Use a clear photo between 256 pixels and 25 megapixels.");
    const scale = Math.min(1, 1536 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not open the photo.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size > 3_000_000) throw new Error("Please choose a smaller photo.");
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } finally { bitmap.close(); }
}
