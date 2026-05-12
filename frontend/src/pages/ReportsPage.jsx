import { useEffect, useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";

export function ReportsPage() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    api.get("/reports").then((res) => setReports(res.data));
  }, []);

  return (
    <SectionCard title="AI Reports" subtitle="Structured risk reports with parcel matching and recommendation trail">
      <div className="space-y-4">
        {reports.map((report) => (
          <div key={report.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-semibold">Report #{report.id}</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{report.summary}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white dark:bg-slate-100 dark:text-slate-900">
                  {report.risk_level} Risk
                </div>
                <a href={`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/reports/${report.id}/download`} target="_blank" rel="noreferrer" className="rounded-2xl bg-ink px-4 py-2 text-sm text-white">
                  Download PDF
                </a>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 text-sm dark:bg-slate-900">
                <div className="font-medium">Risk Score</div>
                <div className="mt-2 text-3xl font-semibold">{report.risk_score}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 text-sm dark:bg-slate-900">
                <div className="font-medium">Recommendation</div>
                <div className="mt-2">{report.report_json.recommendation}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
