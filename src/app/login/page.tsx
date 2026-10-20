"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Shield } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasGoogle = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "1";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) setError("Invalid email or password.");
    else window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Shield className="w-10 h-10 text-noc-accent mx-auto" />
          <h1 className="text-xl font-bold mt-2 tracking-wide">NETGUARDIAN</h1>
          <p className="text-xs text-slate-500">Intelligent Network Monitoring & Security Platform</p>
        </div>
        <form onSubmit={submit} className="panel p-5 space-y-3">
          <label className="block text-xs text-slate-400">Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" placeholder="you@example.com" />
          </label>
          <label className="block text-xs text-slate-400">Password
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1" placeholder="••••••••" />
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button disabled={busy} className="btn-solid w-full">{busy ? "Signing in…" : "Sign in"}</button>
          {hasGoogle && (
            <>
              <div className="text-center text-[10px] text-slate-600">or</div>
              <button type="button" onClick={() => signIn("google", { callbackUrl: "/dashboard" })} className="btn w-full">Continue with Google</button>
            </>
          )}
          <p className="text-xs text-slate-500 text-center">No account? <a href="/register" className="text-noc-accent hover:underline">Create one</a></p>
        </form>
      </div>
    </div>
  );
}
