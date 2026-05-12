export function FormInput({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        {...props}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink dark:border-slate-700 dark:bg-slate-900"
      />
    </label>
  );
}
