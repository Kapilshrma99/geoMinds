import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-mesh p-6 text-haze">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-[2.2rem] border border-white/10 bg-[rgba(5,12,21,0.82)] p-8 shadow-glow backdrop-blur">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.34em] text-fog">
          <ShieldCheck size={12} />
          GeoMind AI
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold">Create a workspace identity</h1>
        <p className="mt-2 text-sm text-slate-300">Provision an analyst profile for parcel intelligence, report synthesis, and audit-grade workflow tracking.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FormInput label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <FormInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FormInput label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-mint"
            >
              <option value="user">User</option>
              <option value="analyst">Analyst</option>
            </select>
          </label>
        </div>
        {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        <button className="mt-6 w-full rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-slate-950">{loading ? "Provisioning..." : "Create Workspace Profile"}</button>
        <div className="mt-4 text-center text-sm text-slate-400">
          Already have access?{" "}
          <Link to="/login" className="font-medium text-mint">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
