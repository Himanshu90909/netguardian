"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Shield } from "lucide-react";
import { post } from "@/lib/client";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      // Chrome autofill can prepend the saved display name to the email — extract the email token.
      const matches = email.trim().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi);
      const cleanEmail = matches ? matches[matches.length - 1] : email.trim();
      await post("/register", { name, email: cleanEmail, password });
      setEmail(cleanEmail);
      const res = await signIn("credentials", { email: cleanEmail, password, redirect: false });
      if (res?.error) setError("Account created — please sign in.");
      else window.location.href = "/dashboard";
    } catch (err: any) { setError(err.message); }
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Shield className="w-10 h-10 text-noc-accent mx-auto" />
          <h1 className="text-xl font-bold mt-2 tracking-wide">Create your account</h1>
          <p className="text-xs text-slate-500">NetGuardian NOC platform</p>
        </div>
        <form onSubmit={submit} noValidate className="panel p-5 space-y-3">
          <label className="block text-xs text-slate-400">Full name
            <input required name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" placeholder="Himanshu Suthar" />
          </label>
          <label className="block text-xs text-slate-400">Email
            <input type="email" required name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" placeholder="you@example.com" />
          </label>
          <label className="block text-xs text-slate-400">Password (min 6 chars)
            <input type="password" required minLength={6} name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1" placeholder="••••••••" />
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button disabled={busy} className="btn-solid w-full">{busy ? "Creating…" : "Create account"}</button>
          <p className="text-xs text-slate-500 text-center">Already registered? <a href="/login" className="text-noc-accent hover:underline">Sign in</a></p>
        </form>
      </div>
    </div>
  );
}
