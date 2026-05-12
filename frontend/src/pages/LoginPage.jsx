import { useState } from "react";
import { Link } from "react-router-dom";

import { FormInput } from "../components/FormInput";
import { useAuth } from "../state/AuthContext";

export function LoginPage() {
  const { login, loading } = useAuth();
  const [form, setForm] = useState({ email: "admin@geomind.ai", password: "admin123" });
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await login(form);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to sign in");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-mesh p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-[2rem] border border-white/60 bg-white/85 p-8 shadow-glow backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
        <div className="text-xs uppercase tracking-[0.4em] text-slate-500">GeoMind AI</div>
        <h1 className="mt-3 text-3xl font-semibold">Sign in to the land intelligence hub</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Demo admin account is prefilled for the hackathon flow.</p>
        <div className="mt-6 space-y-4">
          <FormInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FormInput label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        {error ? <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
        <button className="mt-6 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">{loading ? "Signing in..." : "Login"}</button>
        <div className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
          New user? <Link to="/register" className="font-medium text-ink dark:text-mint">Create an account</Link>
        </div>
      </form>
    </div>
  );
}
