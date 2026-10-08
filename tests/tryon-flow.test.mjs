import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";

const owner = "11111111-1111-4111-8111-111111111111";
const otherOwner = "22222222-2222-4222-8222-222222222222";
const shopId = "33333333-3333-4333-8333-333333333333";
const productId = "44444444-4444-4444-8444-444444444444";
const jwt = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ sub: owner, role: "authenticated", exp: 4102444800 })).toString("base64url"), "test-signature"].join(".");
const shop = { id: shopId, owner_id: owner, name: "QA Collection", slug: "qa-collection", currency: "INR" };
const product = { id: productId, owner_id: owner, shop_id: shopId, name: "QA Shirt", price: 899,
  currency: "INR", image: "https://example.invalid/garment.jpg",
  storage_path: owner + "/55555555-5555-4555-8555-555555555555.jpg", category: "upper_body", active: true };
const jobs = new Map();
let quota = "ok"; let providerFailure = false; let predictedFailure = false;
let starts = 0; let submissions = []; let image; let imageData;
let base; let nextProcess; let apiServer; let nextOutput = "";

async function body(request) {
  const parts = []; for await (const part of request) parts.push(part);
  const text = Buffer.concat(parts).toString();
  return text ? JSON.parse(text) : {};
}
function send(response, value, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}
function projection(value, url) {
  const fields = url.searchParams.get("select");
  if (!fields || fields === "*") return value;
  return Object.fromEntries(fields.split(",").map(key => [key, value[key]]));
}
before(async () => {
  image = await sharp({ create: { width: 384, height: 576, channels: 3, background: "#668b82" } }).jpeg().toBuffer();
  imageData = "data:image/jpeg;base64," + image.toString("base64");
  apiServer = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    try {
      if (url.pathname === "/auth/v1/user") {
        if (request.headers.authorization !== "Bearer " + jwt) return send(response, { message: "Invalid token" }, 401);
        return send(response, { id: owner, aud: "authenticated", role: "authenticated",
          email: "qa@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
      }
      if (url.pathname === "/rest/v1/dress_ai_products")
        return send(response, [projection(product, url)]);
      if (url.pathname === "/rest/v1/dress_ai_shops")
        return send(response, [projection(shop, url)]);
      if (url.pathname === "/rest/v1/rpc/dress_ai_reserve_job") {
        const data = await body(request);
        if (quota === "ok") jobs.set(data.p_id, { id: data.p_id, shop_id: data.p_shop_id,
          product_id: data.p_product_id, token_hash: data.p_token_hash, ip_hash: data.p_ip_hash,
          status: "starting", provider_id: null, expires_at: new Date(Date.now() + 3600000).toISOString() });
        return send(response, quota);
      }
      if (url.pathname === "/rest/v1/dress_ai_jobs") {
        const id = url.searchParams.get("id")?.replace("eq.", "");
        if (request.method === "PATCH") {
          const update = await body(request);
          if (jobs.has(id)) Object.assign(jobs.get(id), update);
          response.writeHead(204); return response.end();
        }
        const record = jobs.get(id);
        return send(response, record ? [projection(record, url)] : []);
      }
      if (url.pathname === "/v1/run") {
        starts++; const submitted = await body(request); submissions.push(submitted);
        if (providerFailure) return send(response, { error: "Private provider payload" }, 503);
        return send(response, { id: "qa-prediction-" + randomUUID(), error: null });
      }
      if (url.pathname.startsWith("/v1/status/")) {
        return send(response, predictedFailure ? { status: "failed", error: {
          name: "PoseError", message: "Never expose provider image input or tokens",
        } } : { status: "completed", output: [imageData], error: null });
      }
      return send(response, { error: "Unexpected test endpoint " + url.pathname }, 404);
    } catch { send(response, { error: "Test backend error" }, 500); }
  });
  apiServer.listen(0, "127.0.0.1"); await once(apiServer, "listening");
  const endpoint = "http://127.0.0.1:" + apiServer.address().port;
  const portHolder = createServer(); portHolder.listen(0, "127.0.0.1"); await once(portHolder, "listening");
  const port = portHolder.address().port; await new Promise(resolve => portHolder.close(resolve));
  base = "http://127.0.0.1:" + port;
  nextProcess = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
    env: { ...process.env, SUPABASE_URL: endpoint, SUPABASE_PUBLISHABLE_KEY: "public-test-key",
      SUPABASE_SECRET_KEY: "private-test-key", SUPABASE_SERVICE_ROLE_KEY: "",
      FASHN_API_KEY: "fashn-test-key", FASHN_API_URL: endpoint + "/v1",
      FASHN_MODEL: "tryon-max", PUBLIC_TRYON_ENABLED: "false", APP_URL: base, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  nextProcess.stdout.on("data", data => { nextOutput = (nextOutput + data).slice(-5000); });
  nextProcess.stderr.on("data", data => { nextOutput = (nextOutput + data).slice(-5000); });
  let ready = false;
  for (let count = 0; count < 100; count++) {
    try { ready = (await fetch(base + "/api/health")).ok; if (ready) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Next.js test server failed to start: " + nextOutput);
}, { timeout: 30000 });
after(async () => {
  if (nextProcess && nextProcess.exitCode === null) {
    nextProcess.kill("SIGTERM"); await once(nextProcess, "exit");
  }
  if (apiServer) { apiServer.closeAllConnections(); await new Promise(resolve => apiServer.close(resolve)); }
});
function form(options = {}) {
  const data = new FormData();
  data.set("personImage", new Blob([options.image || image], { type: options.type || "image/jpeg" }), "person.jpg");
  data.set("productId", options.productId || productId);
  if (options.consent !== false) data.set("consent", "true");
  return data;
}
async function start(options = {}) {
  return fetch(base + "/api/tryon", { method: "POST", body: form(options),
    headers: { ...(options.auth === false ? {} : { Authorization: "Bearer " + jwt }),
      ...(options.origin ? { Origin: options.origin } : {}) } });
}
test("missing consent, wrong origin and unauthenticated visitors cannot start a paid preview", async () => {
  const initial = starts;
  assert.equal((await start({ consent: false })).status, 400);
  assert.equal((await start({ origin: "https://untrusted.example" })).status, 403);
  assert.equal((await start({ auth: false })).status, 401);
  assert.equal(starts, initial);
});
test("invalid photos and oversized request bodies fail before reserving or starting AI work", async () => {
  const initial = starts; const count = jobs.size;
  assert.equal((await start({ image: Buffer.alloc(250, 45) })).status, 400);
  assert.equal((await start({ type: "image/svg+xml" })).status, 400);
  assert.equal((await start({ image: Buffer.alloc(4_000_000, 45) })).status, 413);
  assert.equal(starts, initial); assert.equal(jobs.size, count);
});
test("an owner cannot run a preview with another shop's garment", async () => {
  product.owner_id = otherOwner;
  try { assert.equal((await start()).status, 403); } finally { product.owner_id = owner; }
});
test("daily budget and concurrency denial do not call the AI provider", async () => {
  const initial = starts;
  quota = "limit"; assert.equal((await start()).status, 429);
  quota = "busy"; assert.equal((await start()).status, 429);
  quota = "unavailable"; assert.equal((await start()).status, 404);
  quota = "ok"; assert.equal(starts, initial);
});
test("the real provider adapter submits documented Max inputs and retrieves results using a private capability", async () => {
  const response = await start(); assert.equal(response.status, 202);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const current = await response.json();
  const submitted = submissions.at(-1);
  assert.equal(submitted.model_name, "tryon-max");
  assert.equal(submitted.inputs.generation_mode, "quality");
  assert.equal(submitted.inputs.resolution, "2k");
  assert.equal(submitted.inputs.return_base64, true);
  assert.equal(submitted.inputs.num_images, 1);
  assert.match(submitted.inputs.model_image, /^data:image\/jpeg;base64,/);
  assert.match(submitted.inputs.product_image, /dress-ai-catalogue/);
  assert.equal(submitted.inputs.garment_image, undefined);
  assert.equal(jobs.get(current.requestId).status, "processing");
  assert.ok(!("person_image" in jobs.get(current.requestId)));
  const unknown = await fetch(base + "/api/tryon/" + current.requestId, { headers: { "X-Tryon-Token": "f".repeat(64) } });
  assert.equal(unknown.status, 404);
  const completed = await fetch(base + "/api/tryon/" + current.requestId, { headers: { "X-Tryon-Token": current.token } });
  assert.equal(completed.status, 200);
  const result = await completed.json(); assert.equal(result.status, "completed"); assert.equal(result.image, imageData);
  assert.equal(jobs.get(current.requestId).status, "completed");
  const cleared = await fetch(base + "/api/tryon/" + current.requestId, { method: "DELETE", headers: { "X-Tryon-Token": current.token } });
  assert.equal(cleared.status, 200);
  assert.ok(jobs.has(current.requestId), "Clearing must keep the budget record");
  assert.equal((await fetch(base + "/api/tryon/" + current.requestId, { headers: { "X-Tryon-Token": current.token } })).status, 404);
});
test("provider errors are safe and do not automatically start a second paid request", async () => {
  providerFailure = true; const initial = starts;
  const response = await start(); assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes("Private provider payload"));
  assert.equal(starts, initial + 1); providerFailure = false;
});
test("prediction failure gives actionable photo guidance without exposing provider payloads", async () => {
  const current = await (await start()).json(); predictedFailure = true;
  const response = await fetch(base + "/api/tryon/" + current.requestId, { headers: { "X-Tryon-Token": current.token } });
  const result = await response.json(); assert.equal(result.status, "failed"); assert.match(result.error, /full-body photo/);
  assert.ok(!result.error.includes("tokens")); predictedFailure = false;
});
test("expired preview capabilities cannot retrieve a result", async () => {
  const current = await (await start()).json();
  jobs.get(current.requestId).expires_at = "2000-01-01T00:00:00Z";
  assert.equal((await fetch(base + "/api/tryon/" + current.requestId, { headers: { "X-Tryon-Token": current.token } })).status, 410);
});
test("public catalogue responses omit owner identifiers and private storage paths", async () => {
  const response = await fetch(base + "/api/shop/qa-collection"); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.previewsEnabled, false);
  assert.ok(!("owner_id" in data.shop)); assert.ok(!("owner_id" in data.products[0]));
  assert.ok(!("storage_path" in data.products[0]));
});
test("readiness is owner-only and never exposes credentials", async () => {
  assert.equal((await fetch(base + "/api/owner/readiness")).status, 401);
  const response = await fetch(base + "/api/owner/readiness", { headers: { Authorization: "Bearer " + jwt } });
  assert.equal(response.status, 200); const text = await response.text();
  assert.ok(!text.includes("private-test-key")); assert.ok(!text.includes("fashn-test-key"));
});

test("enabled public shop previews work without owner credentials but still require a private result token", async () => {
  const endpoint = "http://127.0.0.1:" + apiServer.address().port;
  const holder = createServer(); holder.listen(0, "127.0.0.1"); await once(holder, "listening");
  const port = holder.address().port; await new Promise(resolve => holder.close(resolve));
  const publicBase = "http://127.0.0.1:" + port;
  const processUnderTest = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
    env: { ...process.env, SUPABASE_URL: endpoint, SUPABASE_PUBLISHABLE_KEY: "public-test-key",
      SUPABASE_SECRET_KEY: "private-test-key", FASHN_API_KEY: "fashn-test-key", FASHN_API_URL: endpoint + "/v1",
      FASHN_MODEL: "tryon-max", PUBLIC_TRYON_ENABLED: "true", APP_URL: publicBase, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "ignore",
  });
  try {
    let ready = false;
    for (let count = 0; count < 100; count++) {
      try { ready = (await fetch(publicBase + "/api/health")).ok; if (ready) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, "Public test server did not start");
    const catalogue = await (await fetch(publicBase + "/api/shop/qa-collection")).json();
    assert.equal(catalogue.previewsEnabled, true);
    const response = await fetch(publicBase + "/api/tryon", { method: "POST", body: form() });
    assert.equal(response.status, 202);
    const current = await response.json();
    assert.equal((await fetch(publicBase + "/api/tryon/" + current.requestId)).status, 404);
    const result = await (await fetch(publicBase + "/api/tryon/" + current.requestId, { headers: { "X-Tryon-Token": current.token } })).json();
    assert.equal(result.status, "completed");
    const embedded = await fetch(publicBase + "/embed/qa-collection");
    assert.equal(embedded.status, 200); assert.equal(embedded.headers.get("x-frame-options"), null);
  } finally { processUnderTest.kill("SIGTERM"); await once(processUnderTest, "exit"); }
});
