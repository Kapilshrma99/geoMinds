import { Download, FileStack, MapPinned } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";

function riskTone(level) {
  if (level === "High") return "text-red-200 border-red-400/20 bg-red-500/10";
  if (level === "Medium") return "text-amber-200 border-amber-400/20 bg-amber-400/10";
  return "text-mint border-mint/20 bg-mint/10";
}

export function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    api.get("/reports").then((res) => setReports(res.data));
  }, []);

  const downloadReport = async (reportId) => {
    setDownloadingId(reportId);
    setDownloadError("");

    try {
      const response = await api.get(`/reports/${reportId}/download`, {
        responseType: "blob",
      });

      const contentDisposition = response.headers["content-disposition"] || "";
      const match = contentDisposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || `geomind-report-${reportId}.pdf`;
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      setDownloadError(error.response?.data?.detail || "Unable to download this report right now.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <SectionCard
      title="Reports Library"
      subtitle="Review generated property reports"
      helper="Each report card summarizes one analyzed property, including the score, reasoning, recommendation, and export option."
    >
      {downloadError ? <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{downloadError}</div> : null}
      <div className="space-y-4">
        {reports.map((report) => (
          <div key={report.id} className="rounded-[1.9rem] border border-white/10 bg-white/5 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-fog">
                  <FileStack size={12} />
                  Report #{report.id}
                </div>
                <h3 className="mt-3 font-display text-2xl text-haze">{report.report_json.executive_summary || report.summary}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{report.summary}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] ${riskTone(report.risk_level)}`}>
                  {report.risk_level} risk
                </div>
                <button
                  onClick={() => downloadReport(report.id)}
                  disabled={downloadingId === report.id}
                  className="inline-flex items-center gap-2 rounded-2xl bg-mint px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  <Download size={16} />
                  {downloadingId === report.id ? "Downloading..." : "Export PDF"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr_1fr]">
              <div className="rounded-[1.5rem] border border-white/10 bg-storm/80 p-4">
                <div className="text-[11px] uppercase tracking-[0.28em] text-fog">Risk score</div>
                <div className="mt-3 font-display text-5xl text-haze">{report.risk_score}</div>
                <div className="mt-2 text-sm text-slate-300">Composite legal, cadastral, and GIS anomaly signal.</div>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-storm/80 p-4">
                <div className="text-[11px] uppercase tracking-[0.28em] text-fog">Reasoning</div>
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  {(report.report_json.reasoning || []).slice(0, 4).map((reason) => (
                    <div key={reason} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      {reason}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-storm/80 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-fog">
                  <MapPinned size={12} />
                  Recommendation
                </div>
                <div className="mt-3 text-sm leading-7 text-slate-200">{report.report_json.recommendation}</div>
                <div className="mt-4 space-y-2">
                  {(report.report_json.recommended_actions || []).slice(0, 3).map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
