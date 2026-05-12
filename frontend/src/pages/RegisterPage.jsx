import { useState } from "react";
import { Link } from "react-router-dom";

import { FormInput } from "../components/FormInput";
import { useAuth } from "../state/AuthContext";

export function RegisterPage() {
  const { register, loading } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await register(form);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to create account");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-mesh p-6">
      <form onSubmit={submit} className="w-full max-w-lg rounded-[2rem] border border-white/60 bg-white/85 p-8 shadow-glow backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
        <div className="text-xs uppercase tracking-[0.4em] text-slate-500">GeoMind AI</div>
        <h1 className="mt-3 text-3xl font-semibold">Create a workspace identity</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FormInput label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <FormInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FormInput label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="user">User</option>
              <option value="analyst">Analyst</option>
            </select>
          </label>
        </div>
        {error ? <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
        <button className="mt-6 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">{loading ? "Creating..." : "Register"}</button>
        <div className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
          Already have access? <Link to="/login" className="font-medium text-ink dark:text-mint">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
