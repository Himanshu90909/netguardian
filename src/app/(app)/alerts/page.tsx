"use client";
import { useEffect, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty, Loading, sevTone } from "@/components/ui";
import { api, patch } from "@/lib/client";

type Alert = { id: number; severity: string; alert_type: string; message: string; status: string; created_at: string; device_name: string | null; resolved_at: string | null };

export default function Alerts() {
  const { project } = useProject();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sev, setSev] = useState("");
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!project) return;
    const q = new URLSearchParams({ projectId: String(project.id) });
    if (sev) q.set("severity", sev);
    if (status) q.set("status", status);
    api<{ alerts: Alert[] }>(`/alerts?${q}`).then((r) => { setAlerts(r.alerts); setLoaded(true); });
  }, [project, sev, status]);

  async function set(id: number, s: string) {
    await patch(`/alerts/${id}`, { status: s });
    setAlerts((as) => as.map((a) => (a.id === id ? { ...a, status: s } : a)));
  }

  if (!project) return <Empty title="Select a project first" />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Alert Center</h1>
      <div className="flex gap-2">
        <select className="input max-w-40" value={sev} onChange={(e) => setSev(e.target.value)}>
          <option value="">All severities</option>
          <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option>
          <option value="low">Low</option><option value="informational">Informational</option>
        </select>
        <select className="input max-w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="active">Active</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option>
        </select>
      </div>
      <Card>
        {!loaded ? <Loading /> : alerts.length === 0 ? <Empty title="No alerts match the filters" /> : (
          <table className="w-full">
            <thead><tr><th className="th">Severity</th><th className="th">Message</th><th className="th">Device</th><th className="th">Status</th><th className="th">Created</th><th className="th">Actions</th></tr></thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.02]">
                  <td className="td"><Badge tone={sevTone(a.severity)}>{a.severity}</Badge></td>
                  <td className="td text-slate-300 max-w-md">{a.message}</td>
                  <td className="td text-slate-400">{a.device_name ?? "—"}</td>
                  <td className="td"><Badge tone={a.status === "resolved" ? "ok" : a.status === "acknowledged" ? "info" : "warn"}>{a.status}</Badge></td>
                  <td className="td text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="td">
                    <div className="flex gap-2 text-xs">
                      {a.status === "active" && <button className="btn" onClick={() => set(a.id, "acknowledged")}>Acknowledge</button>}
                      {a.status !== "resolved" && <button className="btn" onClick={() => set(a.id, "resolved")}>Resolve</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
