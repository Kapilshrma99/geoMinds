import { Database, Shield, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";

const roles = ["user", "analyst", "admin"];

export function AdminPage() {
  const { user, refreshProfile } = useAuth();
  const [geoServer, setGeoServer] = useState(null);
  const [layers, setLayers] = useState([]);
  const [rules, setRules] = useState([]);
  const [layerForm, setLayerForm] = useState({ name: "", description: "", defaultDistrict: "", file: null });
  const [uploading, setUploading] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAdminData = async () => {
    const [geoServerRes, layersRes, rulesRes] = await Promise.all([
      api.get("/gis/geoserver/publish"),
      api.get("/admin/layers"),
      api.get("/admin/access-rules"),
    ]);
    setGeoServer(geoServerRes.data);
    setLayers(layersRes.data);
    setRules(rulesRes.data);
  };

  useEffect(() => {
    loadAdminData().catch((err) => setError(err.response?.data?.detail || "Unable to load admin controls"));
  }, []);

  const handleLayerUpload = async () => {
    if (!layerForm.name || !layerForm.file) {
      setError("Layer name and JSON or GeoJSON file are required.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("name", layerForm.name);
      formData.append("description", layerForm.description);
      formData.append("default_district", layerForm.defaultDistrict);
      formData.append("file", layerForm.file);
      const { data } = await api.post("/admin/layers/import", formData);
      setMessage(`Imported ${data.imported_parcels} parcels into layer "${data.layer.name}". User uploads can now be analyzed against it.`);
      setLayerForm({ name: "", description: "", defaultDistrict: "", file: null });
      await loadAdminData();
    } catch (err) {
      setError(err.response?.data?.detail || "Layer import failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleRule = (pageKey, role) => {
    setRules((current) =>
      current.map((row) =>
        row.page_key === pageKey
          ? {
              ...row,
              [role]: !row[role],
            }
          : row
      )
    );
  };

  const saveRules = async () => {
    setSavingRules(true);
    setError("");
    setMessage("");
    try {
      const payload = rules.flatMap((row) =>
        roles.map((role) => ({
          page_key: row.page_key,
          role,
          can_view: row[role],
        }))
      );
      const { data } = await api.put("/admin/access-rules", payload);
      setRules(data);
      setMessage("Page access rules updated. New logins will receive the latest visibility map.");
      await refreshProfile();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to save access rules");
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Admin Control Plane" subtitle="Upload backend reference layers and govern who can see each workflow">
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <div>User Role: {user?.role}</div>
            <div>GeoServer Layer Publication: {geoServer?.status || "Loading..."}</div>
            <div>Workspace: {geoServer?.workspace || "geomind"}</div>
            <div>Store: {geoServer?.store || "geomind-postgis"}</div>
            <div>Active Reference Layers: {layers.length}</div>
          </div>
          {message ? <div className="mt-4 rounded-2xl border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-mint">{message}</div> : null}
          {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        </SectionCard>

        <SectionCard title="Layer URLs" subtitle="Use these endpoints to connect WMS/WFS layers into external GIS tools">
          <pre className="overflow-auto rounded-[1.75rem] bg-slate-950 p-5 text-sm text-green-300">{JSON.stringify(geoServer, null, 2)}</pre>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <SectionCard title="Reference Layer Import" subtitle="Admin uploads parcel JSON or GeoJSON so user uploads can be analyzed against preloaded backend data">
          <div className="grid gap-4">
            <label className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-fog">
                <Database size={12} />
                Layer name
              </div>
              <input value={layerForm.name} onChange={(e) => setLayerForm({ ...layerForm, name: e.target.value })} placeholder="Rajasthan May 2026 Parcel Batch" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
            </label>
            <label className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-fog">Description</div>
              <textarea value={layerForm.description} onChange={(e) => setLayerForm({ ...layerForm, description: e.target.value })} rows={4} placeholder="Optional notes about this imported layer" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
            </label>
            <label className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-fog">Default district fallback</div>
              <input value={layerForm.defaultDistrict} onChange={(e) => setLayerForm({ ...layerForm, defaultDistrict: e.target.value })} placeholder="Used if records omit district" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
            </label>
            <label className="rounded-2xl border border-dashed border-mint/30 bg-mint/5 px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-mint">
                <UploadCloud size={12} />
                GeoJSON or JSON layer file
              </div>
              <input type="file" accept=".json,.geojson" onChange={(e) => setLayerForm({ ...layerForm, file: e.target.files?.[0] || null })} className="w-full text-sm text-slate-300" />
              <div className="mt-2 text-xs text-slate-400">Expected fields: `khasra_no`, `owner_name`, `village`, `district`, `area`, `risk_hint`, and optional GeoJSON geometry.</div>
            </label>
            <button onClick={handleLayerUpload} disabled={uploading} className="rounded-2xl bg-mint px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">
              {uploading ? "Importing layer..." : "Upload reference layer"}
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Imported Layers" subtitle="These datasets become part of the backend parcel reference pool used during user analysis">
          <div className="space-y-3">
            {layers.length ? (
              layers.map((layer) => (
                <div key={layer.id} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-haze">{layer.name}</div>
                      <div className="mt-1 text-sm text-slate-300">{layer.description || "No description provided."}</div>
                    </div>
                    <div className="rounded-full border border-mint/20 bg-mint/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-mint">{layer.feature_count} parcels</div>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.2em] text-fog">Source file: {layer.source_filename || "Unknown"}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">No admin-imported reference layers yet. Seeded data is still available for analysis.</div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Page Visibility Matrix" subtitle="Admin decides which role can open which page and component area">
        <div className="overflow-auto rounded-[1.8rem] border border-white/10 bg-white/5">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.26em] text-fog">
              <tr>
                <th className="px-4 py-4">Page</th>
                <th className="px-4 py-4">User</th>
                <th className="px-4 py-4">Analyst</th>
                <th className="px-4 py-4">Admin</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((row) => (
                <tr key={row.page_key} className="border-b border-white/5">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-mint" />
                      {row.label}
                    </div>
                  </td>
                  {roles.map((role) => (
                    <td key={role} className="px-4 py-4">
                      <button onClick={() => toggleRule(row.page_key, role)} className={`rounded-full px-3 py-2 text-xs uppercase tracking-[0.2em] ${row[role] ? "bg-mint text-slate-950" : "bg-storm text-slate-300"}`}>
                        {row[role] ? "Visible" : "Hidden"}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={saveRules} disabled={savingRules} className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
          {savingRules ? "Saving visibility rules..." : "Save page visibility"}
        </button>
      </SectionCard>
    </div>
  );
}
