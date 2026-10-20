"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useProject } from "./ProjectContext";
import { useEffect } from "react";
import { Activity, LayoutDashboard, Network, MonitorSmartphone, Server, Network as NetIcon, Tags, Route, Stethoscope, ShieldAlert, Radar, Bell, ScrollText, FileText, FolderKanban, Settings, GraduationCap, LogOut, Shield } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/topology", label: "Network Topology", icon: Network },
  { href: "/devices", label: "Devices", icon: MonitorSmartphone },
  { href: "/ipam", label: "IP Address Management", icon: Server },
  { href: "/vlans", label: "VLANs", icon: Tags },
  { href: "/routing", label: "Routing", icon: Route },
  { href: "/diagnostics", label: "Diagnostics", icon: Stethoscope },
  { href: "/security", label: "Security", icon: ShieldAlert },
  { href: "/anomalies", label: "Anomaly Detection", icon: Radar },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/concepts", label: "Academic Concepts", icon: GraduationCap },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { project, projects, setProject, authed, loading } = useProject();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading" || loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Loading NetGuardian…</div>;
  }
  if (!authed) return null;

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-noc-border bg-noc-panel flex flex-col sticky top-0 h-screen">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-noc-border">
          <Shield className="w-6 h-6 text-noc-accent" />
          <div>
            <p className="text-sm font-bold tracking-wide text-slate-100">NETGUARDIAN</p>
            <p className="text-[10px] text-slate-500 -mt-0.5">Network Monitoring & Security</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 px-4 py-2 text-sm border-l-2 transition-colors ${
                pathname.startsWith(href)
                  ? "border-noc-accent text-sky-300 bg-noc-accent/5"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"}`}>
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-noc-border">
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="h-14 border-b border-noc-border bg-noc-panel/70 backdrop-blur flex items-center justify-between px-5 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Activity size={15} className="text-noc-ok" />
            <select
              value={project?.id ?? ""}
              onChange={(e) => { const p = projects.find((x) => String(x.id) === e.target.value); if (p) setProject(p); }}
              className="bg-noc-bg border border-noc-border rounded-md text-sm px-2 py-1.5 text-slate-200 focus:outline-none focus:border-noc-accent max-w-64"
              aria-label="Active project"
            >
              {projects.length === 0 && <option value="">No projects yet</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.is_sample ? " (sample)" : ""}
                </option>
              ))}
            </select>
          </div>
          <Link href="/settings" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
            <span className="w-7 h-7 rounded-full bg-noc-accent/20 text-noc-accent flex items-center justify-center text-xs font-bold">
              {(session?.user?.name ?? "U").slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden sm:inline">{session?.user?.name}</span>
          </Link>
        </header>
        <main className="p-5 max-w-[1600px]">{children}</main>
      </div>
    </div>
  );
}
