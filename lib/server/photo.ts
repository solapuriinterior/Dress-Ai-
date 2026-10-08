import "server-only";
import sharp from "sharp";
import { AppError } from "./http";
export async function privatePhoto(file: File) {
  if (file.size < 100 || file.size > 3_000_000) throw new AppError(413, "Use a photo under 3 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new AppError(400, "Choose a JPG, PNG or WebP photo.");
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || "") || !metadata.width || !metadata.height)
      throw new Error("InvalidImage");
    if (metadata.width < 256 || metadata.height < 256 || (metadata.pages || 1) > 1)
      throw new AppError(400, "Use a clear, single photo at least 256 pixels wide and tall.");
    const bytes = await image.rotate().resize({
      width: 1536, height: 2048, fit: "inside", withoutEnlargement: true,
    }).jpeg({ quality: 90 }).toBuffer();
    // Re-encoding removes EXIF/location metadata. This image is never put in a public bucket.
    return "data:image/jpeg;base64," + bytes.toString("base64");
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "This photo could not be opened. Please choose another JPG, PNG or WebP.");
  }
}
