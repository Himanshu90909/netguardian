"use client";
import { ReactNode } from "react";

export function Card({ title, subtitle, children, actions, className = "" }: { title?: string; subtitle?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={`panel ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-noc-border">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function StatCard({ label, value, unit, tone = "default", hint }: { label: string; value: string | number; unit?: string; tone?: "ok" | "warn" | "crit" | "default"; hint?: string }) {
  const toneClass = tone === "ok" ? "text-noc-ok" : tone === "warn" ? "text-noc-warn" : tone === "crit" ? "text-noc-crit" : "text-slate-100";
  return (
    <div className="panel p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>
        {value} {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "ok" | "warn" | "crit" | "info" | "default" }) {
  const map = {
    ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warn: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    crit: "bg-red-500/10 text-red-400 border-red-500/30",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    default: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  };
  return <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full border px-2 py-0.5 ${map[tone]}`}>{children}</span>;
}

export function StatusDot({ status }: { status: string }) {
  const color = status === "online" || status === "up" || status === "secure" ? "bg-noc-ok" : status === "warning" ? "bg-noc-warn" : "bg-noc-crit";
  return <span className={`inline-block w-2 h-2 rounded-full ${color} ${status !== "offline" && status !== "down" ? "animate-pulse" : ""}`} />;
}

export function sevTone(sev: string): "ok" | "warn" | "crit" | "info" | "default" {
  return sev === "critical" ? "crit" : sev === "high" ? "warn" : sev === "medium" ? "info" : "default";
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-slate-400">{title}</p>
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

export function Spinner() {
  return <div className="w-5 h-5 border-2 border-noc-accent border-t-transparent rounded-full animate-spin mx-auto" />;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="py-12 text-center text-sm text-slate-500">
      <div className="w-6 h-6 border-2 border-noc-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
      {label}…
    </div>
  );
}

export function SimBadge() {
  return <Badge tone="info">SIMULATED</Badge>;
}
