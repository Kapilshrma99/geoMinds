import { useState } from "react";

import { AgentTimeline } from "../components/AgentTimeline";
import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";

export function UploadPage() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploaded = await api.post("/documents/upload", formData);
      const analyzed = await api.post(`/ai/analyze-document/${uploaded.data.id}`);
      setAnalysis(analyzed.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard title="Document Upload" subtitle="Upload PDFs, scanned ownership files, khasra records, or coordinate sheets">
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-slate-700 dark:bg-slate-800/60">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mx-auto block text-sm" />
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Supported demo flow: PDF land records, coordinate files, and scanned property documents.
          </p>
          <button onClick={handleUpload} disabled={!file || uploading} className="mt-5 rounded-2xl bg-ink px-5 py-3 text-sm text-white disabled:opacity-50">
            {uploading ? "Running AI pipeline..." : "Upload and analyze"}
          </button>
          {error ? <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
        </div>

        {analysis ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-800/60">
              <div className="text-sm font-medium">Extracted Details</div>
              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <div>Owner: {analysis.extracted_data.owner_name || "Not found"}</div>
                <div>Khasra: {analysis.extracted_data.khasra_no || "Not found"}</div>
                <div>Village: {analysis.extracted_data.village || "Not found"}</div>
                <div>District: {analysis.extracted_data.district || "Not found"}</div>
                <div>Area: {analysis.extracted_data.area || "Not found"}</div>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-800/60">
              <div className="text-sm font-medium">Risk Snapshot</div>
              <div className="mt-3 text-3xl font-semibold">{analysis.report.risk_score}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300">{analysis.report.risk_level} Risk</div>
              <div className="mt-3 text-sm">{analysis.report.summary}</div>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Agent Log" subtitle="Operational trace for the current analysis run">
        <AgentTimeline items={analysis?.agent_log || []} />
      </SectionCard>
    </div>
  );
}
