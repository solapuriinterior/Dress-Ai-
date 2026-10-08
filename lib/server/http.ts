import "server-only";
export class AppError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: {
    "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  } });
}
export function imageResult(data: unknown) {
  // Stream large image-data results instead of buffering a hosting response payload.
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  let offset = 0;
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= encoded.length) { controller.close(); return; }
      controller.enqueue(encoded.subarray(offset, offset + 65536));
      offset += 65536;
    },
  }), { headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
  } });
}
export function failure(error: unknown) {
  if (error instanceof AppError) return json({ error: error.message }, error.status);
  // Do not log customer images, provider payloads, credentials or tokens.
  console.error("Dress AI request failed:", error instanceof Error ? error.name : "UnknownError");
  return json({ error: "Something went wrong. Please try again." }, 500);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new Set([new URL(request.url).origin]);
  if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).origin);
  if (origin && !allowed.has(origin)) throw new AppError(403, "This request is not allowed.");
}
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function limitedForm(request: Request, maximum = 3_700_000) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new AppError(400, "Please upload a photo.");
  const length = Number(request.headers.get("content-length"));
  if (length > maximum) throw new AppError(413, "Please use a smaller photo.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "Please upload a photo.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) { await reader.cancel(); throw new AppError(413, "Please use a smaller photo."); }
    chunks.push(value);
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
  } catch { throw new AppError(400, "The uploaded photo could not be read."); }
}
