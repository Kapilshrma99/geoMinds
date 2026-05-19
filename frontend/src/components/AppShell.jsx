import { motion } from "framer-motion";
import { Bot, FileText, LayoutDashboard, LogOut, Map, Radar, Shield, Sparkles, UploadCloud } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../state/AuthContext";
import { PageTransition } from "./PageTransition";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { to: "/dashboard", label: "Command Center", icon: LayoutDashboard, pageKey: "dashboard" },
  { to: "/upload", label: "Mission Intake", icon: UploadCloud, pageKey: "upload" },
  { to: "/map", label: "Parcel Theatre", icon: Map, pageKey: "map" },
  { to: "/chat", label: "Evidence Chat", icon: Bot, pageKey: "chat" },
  { to: "/reports", label: "Intelligence Reports", icon: FileText, pageKey: "reports" },
  { to: "/admin", label: "Governance", icon: Shield, pageKey: "admin" },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const visiblePages = user?.visible_pages || [];
  const allowedNavItems = navItems.filter((item) => visiblePages.includes(item.pageKey));

  return (
    <div className="min-h-screen bg-mesh text-haze">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="keep-round absolute left-[-8rem] top-0 h-72 w-72 rounded-full bg-mint/10 blur-3xl" />
        <div className="keep-round absolute right-[-4rem] top-24 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="keep-round absolute bottom-[-6rem] left-1/3 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-[1680px] gap-6 p-4 lg:p-6">
        <aside className="glass-panel hidden w-[320px] shrink-0 rounded-[2rem] border border-white/10 p-6 shadow-panel lg:flex lg:flex-col">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3 py-1 text-[11px] uppercase tracking-[0.34em] text-mint">
              <Sparkles size={12} />
              GeoMind AI
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold text-haze">Autonomous Land Intelligence</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Cinematic GIS analytics, multi-agent reasoning, and enterprise-grade land-risk workflows for demo day.
            </p>
          </div>

          <nav className="mt-10 space-y-2">
            {allowedNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    isActive
                      ? "border border-mint/25 bg-mint/12 text-white shadow-glow"
                      : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <span className="rounded-xl border border-white/10 bg-white/5 p-2 text-mint">
                  <Icon size={16} />
                </span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-10 rounded-[1.8rem] border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.34em] text-fog">
              <Radar size={12} />
              Live System
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Planner", "Workflow coordination online"],
                ["GIS", "Spatial index and parcel layers active"],
                ["Risk", "Conflict weighting and report synthesis ready"],
              ].map(([title, detail]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-storm/70 p-3">
                  <div className="font-medium text-haze">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <header className="glass-panel mb-6 rounded-[2rem] border border-white/10 p-5 shadow-panel">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="text-[11px] uppercase tracking-[0.34em] text-fog">Operational Workspace</div>
                <div className="mt-2 font-display text-3xl font-semibold text-haze">
                  {location.pathname === "/dashboard" ? "Command Center" : "Land Intelligence Workspace"}
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  {user?.name} is signed in with {user?.role} access and live parcel intelligence.
                </div>
              </motion.div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-mint/15 bg-mint/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-mint">
                  Operations Online
                </div>
                <ThemeToggle />
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
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
