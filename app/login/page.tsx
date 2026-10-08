"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getSupabase, hasPublicConfig } from "@/lib/supabase";
type Mode = "signin" | "signup" | "forgot" | "update";
export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!hasPublicConfig()) return;
    const client = getSupabase();
    const { data: { subscription } } = client.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => subscription.unsubscribe();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const client = getSupabase();
      if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/login" });
        if (error) throw error;
        setMessage("If an account exists, a password reset link has been sent. Check your inbox.");
      } else if (mode === "update") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/dashboard");
      } else if (mode === "signup") {
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/login" } });
        if (error) throw error;
        if (data.session) router.replace("/dashboard");
        else setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("Please confirm your email before signing in.");
        router.replace("/dashboard");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Sign-in could not be completed."); }
    finally { setBusy(false); }
  }
  function changeMode(next: Mode) { setMode(next); setError(""); setMessage(""); setPassword(""); }
  const titles = { signin: "Welcome back.", signup: "Start your shop.", forgot: "Reset your password.", update: "Choose a new password." };
  return <><SiteHeader /><main className="auth-layout"><aside className="auth-aside"><p className="eyebrow">For shop owners</p><h1>Your collection.<br />A new fitting room.</h1><p>Manage your garments, share your shop and help customers explore their next look.</p><div className="auth-illustration" aria-hidden="true">D<span>AI</span></div></aside>
    <section className="panel auth-panel"><p className="eyebrow">Dress AI account</p><h2>{titles[mode]}</h2>
      {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
      <form onSubmit={submit}>{mode !== "update" && <label>Email address<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>}
        {mode !== "forgot" && <label>Password<input type="password" required minLength={mode === "signin" ? 1 : 8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} /><span className="field-hint">{mode !== "signin" && "Use at least 8 characters."}</span></label>}
        <button className="button full" disabled={busy || !hasPublicConfig()}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "update" ? "Save password" : "Sign in"}</button>
      </form>
      {!hasPublicConfig() && <p className="notice">Shop services are being set up. Please try again later.</p>}
      <div className="auth-switch">{mode === "signin" ? <><button className="text-button" onClick={() => changeMode("forgot")}>Forgot password?</button><p>New to Dress AI? <button className="text-button" onClick={() => changeMode("signup")}>Create an account</button></p></> : mode !== "update" && <button className="text-button" onClick={() => changeMode("signin")}>Back to sign in</button>}</div>
    </section></main></>;
}
