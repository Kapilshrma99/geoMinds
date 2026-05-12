import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("geomind-theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("geomind-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark((value) => !value)}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
