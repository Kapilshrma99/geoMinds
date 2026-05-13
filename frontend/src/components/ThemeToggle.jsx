import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("geomind-theme");
    return stored ? stored === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("geomind-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark((value) => !value)}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 transition hover:bg-white/10"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
