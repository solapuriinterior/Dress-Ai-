import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let instance: SupabaseClient | undefined;
export function hasPublicConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
}
export function getSupabase(): SupabaseClient {
  if (!instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Shop services are being set up. Please try again later.");
    instance = createClient(url, key, { auth: {
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
    } });
  }
  return instance;
}
// Keep the older components compatible while initialization remains lazy.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getSupabase();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
export async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabase().auth.getSession();
  return session ? { Authorization: "Bearer " + session.access_token } : {};
}
