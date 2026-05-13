import { useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, Radar, ScanSearch } from "lucide-react";

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
    <div className="min-h-screen bg-mesh px-6 py-10 text-haze">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.2rem] border border-white/10 bg-white/5 p-8 shadow-panel">
          <div className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3 py-1 text-[11px] uppercase tracking-[0.34em] text-mint">
            <Radar size={12} />
            GeoMind AI
          </div>
          <h1 className="mt-5 max-w-2xl font-display text-5xl font-semibold leading-tight">
            Autonomous land intelligence built for investor-ready GIS demos.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            Upload land records, watch agents resolve cadastral evidence, and present a map-first risk narrative in one cinematic workspace.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Document AI", "Extract ownership and khasra identifiers from uploaded PDFs."],
              ["GIS Matching", "Resolve parcel geometry, boundaries, and nearby land context."],
              ["Risk Reasoning", "Synthesize evidence-backed acquisition risk for decision makers."],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-[1.6rem] border border-white/10 bg-storm/80 p-4">
                <div className="font-medium text-haze">{title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">{detail}</div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="rounded-[2.2rem] border border-white/10 bg-[rgba(5,12,21,0.82)] p-8 shadow-glow backdrop-blur">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.34em] text-fog">
            <LockKeyhole size={12} />
            Secure Workspace Login
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold text-haze">Enter the command layer</h2>
          <p className="mt-2 text-sm text-slate-300">Demo admin credentials are prefilled so you can move straight into the live analysis story.</p>
          <div className="mt-6 space-y-4">
            <FormInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <FormInput label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-slate-950">
            <ScanSearch size={16} />
            {loading ? "Authenticating..." : "Launch Workspace"}
          </button>
          <div className="mt-4 text-center text-sm text-slate-400">
            New user?{" "}
            <Link to="/register" className="font-medium text-mint">
              Create an account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
