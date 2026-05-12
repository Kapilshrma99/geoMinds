import { motion } from "framer-motion";
import { Bot, FileText, LayoutDashboard, LogOut, Map, Shield, Sparkles, UploadCloud } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../state/AuthContext";
import { PageTransition } from "./PageTransition";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload Document", icon: UploadCloud },
  { to: "/map", label: "Map Intelligence", icon: Map },
  { to: "/chat", label: "AI Chat", icon: Bot },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/admin", label: "Admin Panel", icon: Shield },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-mesh text-slate-900 transition-colors duration-300 dark:bg-command dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-10 h-64 w-64 rounded-full bg-mint/20 blur-3xl dark:bg-mint/10" />
        <div className="absolute right-[-4rem] top-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl dark:bg-gold/10" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl dark:bg-cyan-300/10" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-[1680px] gap-6 p-4 lg:p-6">
        <aside className="glass-panel hidden w-80 shrink-0 rounded-[2rem] border border-white/50 p-6 shadow-panel dark:border-white/10 lg:block">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
              <Sparkles size={12} />
              GeoMind AI
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold">Land Intelligence Agent</h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Enterprise-grade property due diligence, GIS conflict detection, and AI-generated legal risk context.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    isActive
                      ? "bg-ink text-white shadow-lg"
                      : "text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-800/70"
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-10 overflow-hidden rounded-3xl bg-ink p-5 text-white">
            <div className="text-xs uppercase tracking-[0.35em] text-mint">Agent Status</div>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              Planner, Document, GIS, Conflict, Risk, and Report agents are connected to the same operational trail.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {["Planner", "GIS", "Risk"].map((label) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center text-[11px] uppercase tracking-[0.2em] text-slate-200">
                  {label}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <header className="glass-panel mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/50 p-5 shadow-panel dark:border-white/10 md:flex-row md:items-center md:justify-between">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Workspace</div>
              <div className="mt-2 font-display text-2xl font-semibold">Welcome back, {user?.name}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300">{user?.role} access active with live parcel intelligence</div>
            </motion.div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 lg:block">
                Command Layer Online
              </div>
              <ThemeToggle />
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm text-white transition hover:opacity-90"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </header>

          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
