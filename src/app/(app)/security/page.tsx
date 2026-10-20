"use client";
import { useEffect, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty, Loading } from "@/components/ui";
import { api, post } from "@/lib/client";

type Acl = { id: number; rule_number: number; source_ip: string; destination_ip: string; protocol: string; port: string; action: string; note: string | null };
type PortSec = { id: number; device_name: string | null; switch_port: string; mac_address: string; status: string; violation_count: number; max_mac: number };
type Finding = { device_id: number; deviceName?: string; kind: string; severity: string; detail: string; evidence: string };
type Device = { id: number; name: string; device_type: string };

export default function Security() {
  const { project } = useProject();
  const [acl, setAcl] = useState<Acl[]>([]);
  const [portSec, setPortSec] = useState<PortSec[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [aclForm, setAclForm] = useState({ rule_number: "", source_ip: "", destination_ip: "", protocol: "TCP", port: "any", action: "DENY", note: "" });
  const [psForm, setPsForm] = useState({ device_id: "", switch_port: "", mac_address: "", max_mac: "1" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!project) return;
    const s = await api<{ acl: Acl[]; portSecurity: PortSec[] }>(`/security?projectId=${project.id}`);
    const d = await api<{ devices: Device[] }>(`/devices?projectId=${project.id}`);
    setAcl(s.acl); setPortSec(s.portSecurity); setDevices(d.devices);
  }
  useEffect(() => { load(); }, [project]);

  async function addAcl() {
    try {
      await post("/security", { kind: "acl", project_id: project!.id, rule_number: Number(aclForm.rule_number), source_ip: aclForm.source_ip, destination_ip: aclForm.destination_ip, protocol: aclForm.protocol, port: aclForm.port, action: aclForm.action, note: aclForm.note || undefined });
      setAclForm({ ...aclForm, rule_number: "", source_ip: "", destination_ip: "", note: "" }); setErr(""); await load();
    } catch (e: any) { setErr(e.message); }
  }
  async function addPs() {
    try {
      await post("/security", { kind: "port_security", project_id: project!.id, device_id: Number(psForm.device_id), switch_port: psForm.switch_port, mac_address: psForm.mac_address, max_mac: Number(psForm.max_mac) });
      setPsForm({ ...psForm, device_id: "", switch_port: "", mac_address: "" }); setErr(""); await load();
    } catch (e: any) { setErr(e.message); }
  }
  async function scan() {
    setBusy(true);
    try { const r = await post<{ findings: Finding[] }>(`/security/scan?projectId=${project!.id}`); setFindings(r.findings); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  if (!project) return <Empty title="Select a project first" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Network Security</h1>
        <button className="btn" disabled={busy} onClick={scan}>{busy ? "Scanning…" : "Run suspicious traffic scan"}</button>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}

      <Card title="Access Control Lists (ACL)" subtitle="Conceptual rule set — evaluated top-down, first match wins (like Cisco IOS ACLs)">
        <div className="grid sm:grid-cols-7 gap-2 items-end mb-4">
          <input className="input" placeholder="#" value={aclForm.rule_number} onChange={(e) => setAclForm({ ...aclForm, rule_number: e.target.value })} />
          <input className="input" placeholder="Source IP/net" value={aclForm.source_ip} onChange={(e) => setAclForm({ ...aclForm, source_ip: e.target.value })} />
          <input className="input" placeholder="Dest IP/net" value={aclForm.destination_ip} onChange={(e) => setAclForm({ ...aclForm, destination_ip: e.target.value })} />
          <select className="input" value={aclForm.protocol} onChange={(e) => setAclForm({ ...aclForm, protocol: e.target.value })}>
            <option>TCP</option><option>UDP</option><option>ICMP</option>
          </select>
          <input className="input" placeholder="Port" value={aclForm.port} onChange={(e) => setAclForm({ ...aclForm, port: e.target.value })} />
          <select className="input" value={aclForm.action} onChange={(e) => setAclForm({ ...aclForm, action: e.target.value })}>
            <option>DENY</option><option>ALLOW</option>
          </select>
          <button className="btn-solid" onClick={addAcl}>Add rule</button>
        </div>
        {acl.length === 0 ? <Empty title="No ACL rules" /> : (
          <table className="w-full">
            <thead><tr><th className="th">#</th><th className="th">Source</th><th className="th">Destination</th><th className="th">Protocol</th><th className="th">Port</th><th className="th">Action</th><th className="th">Note</th></tr></thead>
            <tbody>
              {acl.map((r) => (
                <tr key={r.id}>
                  <td className="td text-slate-500">{r.rule_number}</td>
                  <td className="td font-mono text-slate-300">{r.source_ip}</td>
                  <td className="td font-mono text-slate-300">{r.destination_ip}</td>
                  <td className="td text-slate-400">{r.protocol}</td>
                  <td className="td text-slate-400">{r.port}</td>
                  <td className="td"><Badge tone={r.action === "ALLOW" ? "ok" : "crit"}>{r.action}</Badge></td>
                  <td className="td text-xs text-slate-500">{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Port Security" subtitle="Sticky MAC limiting on switch access ports (conceptual)">
        <div className="grid sm:grid-cols-5 gap-2 items-end mb-4">
          <select className="input" value={psForm.device_id} onChange={(e) => setPsForm({ ...psForm, device_id: e.target.value })}>
            <option value="">Device…</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input className="input" placeholder="Port (Gi1/0/5)" value={psForm.switch_port} onChange={(e) => setPsForm({ ...psForm, switch_port: e.target.value })} />
          <input className="input" placeholder="MAC (00:1B:44:...)" value={psForm.mac_address} onChange={(e) => setPsForm({ ...psForm, mac_address: e.target.value })} />
          <input className="input" placeholder="Max MACs" value={psForm.max_mac} onChange={(e) => setPsForm({ ...psForm, max_mac: e.target.value })} />
          <button className="btn-solid" onClick={addPs}>Add</button>
        </div>
        {portSec.length === 0 ? <Empty title="No port security entries" /> : (
          <table className="w-full">
            <thead><tr><th className="th">Switch</th><th className="th">Port</th><th className="th">Sticky MAC</th><th className="th">Status</th><th className="th">Violations</th><th className="th">Max MACs</th></tr></thead>
            <tbody>
              {portSec.map((p) => (
                <tr key={p.id}>
                  <td className="td text-slate-300">{p.device_name ?? "—"}</td>
                  <td className="td font-mono text-slate-400">{p.switch_port}</td>
                  <td className="td font-mono text-slate-300">{p.mac_address}</td>
                  <td className="td"><Badge tone={p.status === "secure" ? "ok" : "crit"}>{p.status}</Badge></td>
                  <td className="td text-slate-400">{p.violation_count}</td>
                  <td className="td text-slate-500">{p.max_mac}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Suspicious Traffic Detection" subtitle="Heuristic analysis of stored metrics — educational, NOT a real IDS">
        {findings === null ? <Empty title="Run a scan to analyze recent metrics for anomalies" hint="Bandwidth spikes, excessive loss, connection floods, devices going dark." /> :
         findings.length === 0 ? <Empty title="Scan complete — no suspicious patterns detected" /> : (
          <div className="space-y-2">
            {findings.map((f, i) => (
              <div key={i} className="flex gap-3 items-start p-3 rounded-md bg-noc-bg border border-noc-border">
                <Badge tone={f.severity === "high" ? "crit" : f.severity === "critical" ? "crit" : "warn"}>{f.severity}</Badge>
                <div>
                  <p className="text-sm text-slate-200">{f.deviceName ?? `Device #${f.device_id}`} — {f.kind.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-400">{f.detail}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">Evidence: {f.evidence}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-600 mt-3">This is heuristic analysis of simulated network_metrics — it does not inspect real packets and is not an enterprise IDS/IPS.</p>
      </Card>
    </div>
  );
}
