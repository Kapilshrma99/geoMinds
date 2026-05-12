import { motion } from "framer-motion";

export function StatCard({ title, value, hint, color = "from-white to-white" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.25 }}
      className={`relative overflow-hidden rounded-[1.75rem] border border-white/50 bg-gradient-to-br ${color} p-5 shadow-panel dark:border-white/10 dark:from-slate-900 dark:to-slate-800`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-mint/40" />
      <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-3 font-display text-3xl font-semibold">{value}</div>
      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{hint}</div>
    </motion.div>
  );
}
