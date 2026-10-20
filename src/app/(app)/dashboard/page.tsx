"use client";
import { useEffect, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Card, StatCard, Badge, Loading, Empty, SimBadge, sevTone } from "@/components/ui";
import { api, post } from "@/lib/client";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";

type Series = { t: string; latency: number; packetLoss: number; bandwidth: number; upload: number; download: number; cpu: number; memory: number };
type MetricsResp = { series: Series[]; summary: { totalDevices: number; online: number; offline: number; avgLatency: number; avgLoss: number; totalBandwidth: number } | null };
type AlertRow = { id: number; severity: string; message: string; status: string; created_at: string; device_name: string | null };

export default function Dashboard() {
  const { project, seedSample, authed } = useProject();
  const [metrics, setMetrics] = useState<MetricsResp | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!project) return;
    Promise.all([
      api<MetricsResp>(`/metrics?projectId=${project.id}&window=24`),
      api<{ alerts: AlertRow[] }>(`/alerts?projectId=${project.id}&status=active`),
    ]).then(([m, a]) => { setMetrics(m); setAlerts(a.alerts); }).catch(() => null);
  }, [project]);

  if (!authed) return null;
  if (!project)
    return (
      <Card title="Get started">
        <p className="text-sm text-slate-400">No projects yet. Load the sample network or create a project.</p>
        <div className="flex gap-2 mt-3">
          <button className="btn-solid" disabled={busy} onClick={async () => { setBusy(true); await seedSample().catch(() => null); setBusy(false); }}>
            {busy ? "Creating…" : "Create sample project"}
          </button>
          <a className="btn" href="/projects">New project</a>
        </div>
      </Card>
    );

  const s = metrics?.summary;
  const sevCount = (sev: string) => alerts.filter((a) => a.severity === sev).length;
  const alertDist = ["critical", "high", "medium", "low", "informational"].map((sev) => ({ name: sev, value: sevCount(sev) })).filter((x) => x.value > 0);
  const sevColors: Record<string, string> = { critical: "#f87171", high: "#fbbf24", medium: "#38bdf8", low: "#94a3b8", informational: "#64748b" };
  const availability = s ? [{ name: "Online", value: s.online }, { name: "Offline", value: s.offline }] : [];
  const traffic = metrics?.series?.slice(-12) ?? [];
  const uptimePct = s ? ((s.online / Math.max(s.totalDevices, 1)) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Network Operations Dashboard</h1>
          <p className="text-xs text-slate-500">{project.name} · {project.network_type} {project.is_sample && <Badge tone="info">sample · simulated metrics</Badge>}</p>
        </div>
        <button className="btn" disabled={busy} onClick={async () => { setBusy(true); await post("/metrics", { project_id: project.id }).catch(() => null); location.reload(); }}>
          {busy ? "Collecting…" : "Collect simulated telemetry"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard label="Total Devices" value={s?.totalDevices ?? "—"} />
        <StatCard label="Online" value={s?.online ?? "—"} tone="ok" />
        <StatCard label="Offline" value={s?.offline ?? "—"} tone={s?.offline ? "crit" : "default"} />
        <StatCard label="Active Alerts" value={alerts.length} tone={alerts.length ? "warn" : "default"} />
        <StatCard label="Avg Latency" value={s?.avgLatency ?? "—"} unit="ms" />
        <StatCard label="Packet Loss" value={s?.avgLoss ?? "—"} unit="%" tone={(s?.avgLoss ?? 0) > 2 ? "warn" : "default"} />
        <StatCard label="Uptime" value={uptimePct} unit="%" tone="ok" />
        <StatCard label="Bandwidth" value={s?.totalBandwidth ?? "—"} unit="Mbps" />
      </div>

      {!metrics ? <Loading label="Loading telemetry" /> : metrics.series.length === 0 ? (
        <Card><Empty title="No telemetry yet" hint="Devices have no metric history. Add devices and collect simulated telemetry." /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Network Latency" subtitle="Hourly average across devices (ms) — simulated"><ChartMini data={metrics.series} y="latency" color="#38bdf8" suffix=" ms" /></Card>
          <Card title="Packet Loss" subtitle="Hourly average (%) — simulated"><ChartMini data={metrics.series} y="packetLoss" color="#fbbf24" suffix=" %" /></Card>
          <Card title="Bandwidth Utilization" subtitle="Total Mbps (up/down) — simulated">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={metrics.series}>
                <defs>
                  <linearGradient id="dl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} /><stop offset="100%" stopColor="#38bdf8" stopOpacity={0} /></linearGradient>
                  <linearGradient id="ul" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.4} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="t" stroke="#475569" fontSize={11} /><YAxis stroke="#475569" fontSize={11} />
                <Tooltip contentStyle={{ background: "#141c28", border: "1px solid #1e2936", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="download" stroke="#38bdf8" fill="url(#dl)" name="Download (Mbps)" />
                <Area type="monotone" dataKey="upload" stroke="#34d399" fill="url(#ul)" name="Upload (Mbps)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          <Card title="CPU / Memory Utilization" subtitle="Average across devices (%) — simulated">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metrics.series}>
                <CartesianGrid stroke="#1e2936" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="#475569" fontSize={11} /><YAxis stroke="#475569" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "#141c28", border: "1px solid #1e2936", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="cpu" stroke="#38bdf8" dot={false} name="CPU %" strokeWidth={2} />
                <Line type="monotone" dataKey="memory" stroke="#a78bfa" dot={false} name="Memory %" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Device Availability" subtitle="Current inventory status">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={availability} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} stroke="none"
                  label={({ name, value }: any) => `${name}: ${value}`}>
                  <Cell fill="#34d399" /><Cell fill="#f87171" />
                </Pie>
                <Tooltip contentStyle={{ background: "#141c28", border: "1px solid #1e2936", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Alerts by Severity" subtitle="Active alert distribution">
            {alertDist.length === 0 ? <Empty title="No active alerts" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={alertDist}>
                  <XAxis dataKey="name" stroke="#475569" fontSize={11} /><YAxis stroke="#475569" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#141c28", border: "1px solid #1e2936", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {alertDist.map((e) => <Cell key={e.name} fill={sevColors[e.name]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}

      <Card title="Traffic Distribution" subtitle="Recent upload/download split (simulated)"><SimBadge /></Card>
      {traffic.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Recent avg download" value={traffic.reduce((a, x) => a + x.download, 0) / traffic.length} unit="Mbps" />
          <StatCard label="Recent avg upload" value={traffic.reduce((a, x) => a + x.upload, 0) / traffic.length} unit="Mbps" />
        </div>
      )}

      <Card title="Recent Active Alerts" subtitle={`${alerts.length} active`}>
        {alerts.length === 0 ? <Empty title="All clear — no active alerts" /> : (
          <table className="w-full">
            <thead><tr><th className="th">Severity</th><th className="th">Message</th><th className="th">Device</th><th className="th">Time</th></tr></thead>
            <tbody>
              {alerts.slice(0, 8).map((a) => (
                <tr key={a.id}>
                  <td className="td"><Badge tone={sevTone(a.severity)}>{a.severity}</Badge></td>
                  <td className="td text-slate-300">{a.message}</td>
                  <td className="td text-slate-400">{a.device_name ?? "—"}</td>
                  <td className="td text-slate-500 text-xs">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function ChartMini({ data, y, color, suffix }: { data: Series[]; y: keyof Series; color: string; suffix: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`g-${y}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke="#1e2936" strokeDasharray="3 3" />
        <XAxis dataKey="t" stroke="#475569" fontSize={11} /><YAxis stroke="#475569" fontSize={11} />
        <Tooltip contentStyle={{ background: "#141c28", border: "1px solid #1e2936", borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey={y as string} stroke={color} fill={`url(#g-${y})`} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
