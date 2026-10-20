"use client";
import { useEffect, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty, Loading, SimBadge, sevTone } from "@/components/ui";
import { api } from "@/lib/client";

type Report = {
  project: any; generatedAt: string;
  inventory: { total: number; online: number; offline: number };
  vlans: any[]; routes: any[]; links: any[]; alerts: any[]; logs: any[];
  performance: { avgLatencyMs: number; avgPacketLoss: number; uptimePct: number };
  anomalies: any[]; recommendations: string[]; dataNote: string;
};

export default function Reports() {
  const { project } = useProject();
  const [report, setReport] = useState<Report | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!project) return;
    api<{ report: Report }>(`/reports?projectId=${project.id}`).then((r) => { setReport(r.report); setLoaded(true); });
  }, [project]);

  if (!project) return <Empty title="Select a project first" />;
  if (!loaded || !report) return <Loading label="Compiling report" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Network Report — {report.project.name}</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => window.print()}>Download PDF (print)</button>
          <a className="btn" href={`/api/reports/csv?projectId=${project.id}`}>Export CSV</a>
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-2">Generated {new Date(report.generatedAt).toLocaleString()} · {report.dataNote}</p>

      <div className="grid md:grid-cols-4 gap-3">
        <div className="panel p-4"><p className="text-xs text-slate-500">DEVICES</p><p className="text-xl font-semibold mt-1">{report.inventory.total} <span className="text-xs text-slate-600">({report.inventory.online} online)</span></p></div>
        <div className="panel p-4"><p className="text-xs text-slate-500">AVG LATENCY</p><p className="text-xl font-semibold mt-1">{report.performance.avgLatencyMs} ms</p></div>
        <div className="panel p-4"><p className="text-xs text-slate-500">PACKET LOSS</p><p className="text-xl font-semibold mt-1">{report.performance.avgPacketLoss}%</p></div>
        <div className="panel p-4"><p className="text-xs text-slate-500">UPTIME</p><p className="text-xl font-semibold mt-1">{report.performance.uptimePct}%</p></div>
      </div>

      <Card title="Network architecture" subtitle={`${report.links.length} topology links`}>
        <p className="text-sm text-slate-400 mb-2">{report.project.description ?? "—"}</p>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{report.inventory.total} devices</Badge>
          <Badge tone="info">{report.vlans.length} VLANs</Badge>
          <Badge tone="info">{report.routes.length} routes</Badge>
          <Badge tone="info">{report.alerts.filter((a) => a.status === "active").length} active alerts</Badge>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="VLAN configuration">
          {report.vlans.length === 0 ? <Empty title="No VLANs" /> : (
            <table className="w-full text-xs"><thead><tr><th className="th">ID</th><th className="th">Name</th><th className="th">Subnet</th><th className="th">Gateway</th></tr></thead>
            <tbody>{report.vlans.map((v) => <tr key={v.id}><td className="td">{v.vlan_id}</td><td className="td">{v.name}</td><td className="td font-mono">{v.subnet}</td><td className="td font-mono">{v.gateway}</td></tr>)}</tbody></table>
          )}
        </Card>
        <Card title="Routing configuration">
          {report.routes.length === 0 ? <Empty title="No routes" /> : (
            <table className="w-full text-xs"><thead><tr><th className="th">Destination</th><th className="th">Next hop</th><th className="th">Protocol</th><th className="th">Metric</th></tr></thead>
            <tbody>{report.routes.map((r) => <tr key={r.id}><td className="td font-mono">{r.destination}</td><td className="td font-mono">{r.next_hop ?? r.interface_name}</td><td className="td">{r.protocol}</td><td className="td">{r.metric}</td></tr>)}</tbody></table>
          )}
        </Card>
        <Card title="Security events & alerts">
          {report.alerts.length === 0 ? <Empty title="No alerts" /> : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto text-xs">
              {report.alerts.slice(0, 15).map((a) => (
                <p key={a.id} className="flex gap-2 items-start"><Badge tone={sevTone(a.severity)}>{a.severity}</Badge><span className="text-slate-400">{a.message}</span></p>
              ))}
            </div>
          )}
        </Card>
        <Card title="Detected anomalies" actions={<SimBadge />}>
          {report.anomalies.length === 0 ? <Empty title="No anomalies flagged" /> : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto text-xs">
              {report.anomalies.slice(0, 15).map((a, i) => (
                <p key={i} className="text-slate-400">{a.deviceName ?? `#${a.device_id}`}: {a.metric} expected {a.expected}, observed {a.observed} (risk {a.riskScore}/100)</p>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Recommendations">
        <ul className="text-sm text-slate-300 space-y-1.5 list-disc pl-4">
          {report.recommendations.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </Card>
    </div>
  );
}
