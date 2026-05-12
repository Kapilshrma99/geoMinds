import { motion } from "framer-motion";

export function AgentTimeline({ items = [] }) {
  const statusStyle = (status) => {
    if (status === "running") return "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";
    if (status === "failed") return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200";
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200";
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <motion.div
          key={`${item.id || item.agent}-${index}`}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.04 }}
          className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/60"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{item.agent}</div>
            <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${statusStyle(item.status)}`}>
              {item.status || "completed"}
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{item.message}</div>
          {item.created_at ? <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{new Date(item.created_at).toLocaleString()}</div> : null}
        </motion.div>
      ))}
    </div>
  );
}
