"use client";
import { useEffect, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty } from "@/components/ui";
import { api, post } from "@/lib/client";

type Anomaly = { device_id: number; deviceName?: string; metric: string; expected: number; observed: number; deviationPct: number; riskScore: number; reason: string };
type Device = { id: number; name: string; status: string; device_type: string };

const SCENARIOS = [
  { id: "bandwidth_spike", label: "Bandwidth spike" },
  { id: "high_latency", label: "High latency" },
  { id: "packet_loss", label: "Packet loss" },
  { id: "device_failure", label: "Device failure" },
  { id: "router_failure", label: "Router failure" },
  { id: "switch_failure", label: "Switch failure" },
];

export default function Anomalies() {
  const { project } = useProject();
  const [anomalies, setAnomalies] = useState<Anomaly[] | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [scenarioDev, setScenarioDev] = useState<number | "">("");

  async function load() {
    if (!project) return;
    const d = await api<{ devices: Device[] }>(`/devices?projectId=${project.id}`);
    setDevices(d.devices);
    const r = await api<{ anomalies: Anomaly[] }>(`/anomalies?projectId=${project.id}`);
    setAnomalies(r.anomalies);
  }
  useEffect(() => { load(); }, [project]);

  async function detect() {
    setBusy("detect");
    try {
      const r = await post<{ anomalies: Anomaly[]; method?: string }>(`/anomalies?projectId=${project!.id}`);
      setAnomalies(r.anomalies);
      setMsg(`Scan complete — ${r.anomalies.length} anomaly(ies) flagged. Method: ${r.method}.`);
    } catch (e: any) { setMsg(e.message); }
    setBusy("");
  }

  async function simulate(scenario: string) {
    setBusy(scenario);
    try {
      const r = await post<{ message?: string; device?: string; impactedDevices?: string[] }>("/simulation", {
        project_id: project!.id, scenario, device_id: scenarioDev || undefined,
      });
      const extra = r.impactedDevices?.length ? ` Impacted: ${r.impactedDevices.join(", ")}.` : "";
      setMsg(`${r.message ?? "Scenario applied."}${extra}`);
      await load();
    } catch (e: any) { setMsg(e.message); }
    setBusy("");
  }

  async function recover() {
    setBusy("recover");
    try { const r = await post("/simulation", { project_id: project!.id, scenario: "device_recovery", device_id: scenarioDev || undefined }); setMsg(r.message ?? "Recovered."); await load(); }
    catch (e: any) { setMsg(e.message); }
    setBusy("");
  }

  if (!project) return <Empty title="Select a project first" />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Anomaly Detection &amp; Simulation</h1>
      <p className="text-xs text-slate-500 -mt-2">Explainable statistical engine: each device&apos;s metrics are baselined; deviations beyond a z-score threshold are flagged with expected vs observed values.</p>

      <Card title="Network Simulation" subtitle="Inject failures and traffic anomalies — topology, logs and alerts update for real in the database">
        <div className="flex flex-wrap gap-2 items-center">
          <select className="input max-w-48" value={scenarioDev} onChange={(e) => setScenarioDev(e.target.value === "" ? "" : Number(e.target.value))} aria-label="Target device">
            <option value="">Auto-select device…</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.status})</option>)}
          </select>
          {SCENARIOS.map((s) => (
            <button key={s.id} className="btn" disabled={busy !== ""} onClick={() => simulate(s.id)}>{busy === s.id ? "…" : s.label}</button>
          ))}
          <button className="btn" disabled={busy !== ""} onClick={recover}>Recover device</button>
        </div>
        {msg && <p className="text-xs text-slate-400 mt-3">{msg}</p>}
        <p className="text-[11px] text-slate-600 mt-2">On failure: device goes offline, attached links go down, an event log + critical alert are written, and connectivity is recalculated to list impacted devices. Alternate-path selection is explained on the Routing page.</p>
      </Card>

      <Card title="Explainable anomalies" actions={<button className="btn-solid" disabled={busy !== ""} onClick={detect}>{busy === "detect" ? "Scanning…" : "Run detection"}</button>}>
        {anomalies === null ? <Empty title="Run detection to analyze device baselines" /> : anomalies.length === 0 ? <Empty title="No anomalies detected — all devices within baseline" /> : (
          <table className="w-full">
            <thead><tr><th className="th">Device</th><th className="th">Metric</th><th className="th">Expected</th><th className="th">Observed</th><th className="th">Deviation</th><th className="th">Risk</th><th className="th">Reason</th></tr></thead>
            <tbody>
              {anomalies.map((a, i) => (
                <tr key={i}>
                  <td className="td text-slate-300">{a.deviceName ?? `#${a.device_id}`}</td>
                  <td className="td text-slate-400">{a.metric.replace(/_/g, " ")}</td>
                  <td className="td font-mono text-slate-400">{a.expected}</td>
                  <td className="td font-mono text-slate-300">{a.observed}</td>
                  <td className="td font-mono">{a.deviationPct > 0 ? `+${a.deviationPct}%` : `${a.deviationPct}%`}</td>
                  <td className="td"><Badge tone={a.riskScore >= 75 ? "crit" : a.riskScore >= 50 ? "warn" : "info"}>{a.riskScore}/100</Badge></td>
                  <td className="td text-xs text-slate-500 max-w-72">{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
