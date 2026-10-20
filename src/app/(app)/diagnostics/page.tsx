"use client";
import { useEffect, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty, SimBadge } from "@/components/ui";
import { api, post } from "@/lib/client";

type Device = { id: number; name: string; ip_address: string | null; status: string };

export default function Diagnostics() {
  const { project } = useProject();
  const [devices, setDevices] = useState<Device[]>([]);
  const [source, setSource] = useState<number | "">("");
  const [target, setTarget] = useState("");
  const [domain, setDomain] = useState("lpu.in");
  const [host, setHost] = useState("lpu.in");
  const [pingResult, setPingResult] = useState<any>(null);
  const [traceResult, setTraceResult] = useState<any>(null);
  const [dnsResult, setDnsResult] = useState<any>(null);
  const [portResult, setPortResult] = useState<any>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!project) return;
    api<{ devices: Device[] }>(`/devices?projectId=${project.id}`).then((r) => { setDevices(r.devices); if (r.devices[0]) setSource(r.devices[0].id); });
  }, [project]);

  async function run(tool: string, extra: Record<string, unknown> = {}) {
    if (!project) return;
    setBusy(tool);
    try {
      const r = await post(`/diagnostics`, { project_id: project.id, tool, source_device: source || undefined, target: target || host || domain, ...extra });
      if (tool === "ping") setPingResult(r);
      if (tool === "traceroute") setTraceResult(r);
      if (tool === "dns") setDnsResult(r);
      if (tool === "port") setPortResult(r);
    } catch (e: any) { alert(e.message); }
    setBusy("");
  }

  if (!project) return <Empty title="Select a project first" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Network Diagnostics</h1>
        <Badge tone="info">Controlled educational diagnostics</Badge>
      </div>
      <p className="text-xs text-slate-500 -mt-2">Ping &amp; Traceroute are <b>simulated</b> over your modeled topology (hop-by-hop graph paths, labeled SIMULATED). DNS Lookup &amp; Port Check run <b>real queries</b> from the server.</p>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Ping" subtitle="ICMP echo — simulated over topology">
          <div className="flex gap-2 items-end">
            <select className="input max-w-48" value={source} onChange={(e) => setSource(Number(e.target.value))} aria-label="Source device">
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input className="input max-w-40" placeholder="Destination IP (10.40.0.13)" value={target} onChange={(e) => setTarget(e.target.value)} />
            <button className="btn-solid" disabled={!source || !target || busy === "ping"} onClick={() => run("ping")}>{busy === "ping" ? "Pinging…" : "Ping"}</button>
          </div>
          {pingResult?.result && (
            <div className="mt-4 text-sm">
              <p className="font-mono text-xs text-slate-500">Pinging {target} with 4 packets (simulated):</p>
              <div className="grid grid-cols-3 gap-y-1 mt-2">
                <span className="text-slate-500">Packets sent</span><span className="text-slate-300">{pingResult.result.packetsSent}</span><span></span>
                <span className="text-slate-500">Packets received</span><span className="text-slate-300">{pingResult.result.packetsReceived}</span><span></span>
                <span className="text-slate-500">Packet loss</span><span className="text-slate-300">{pingResult.result.packetLoss}%</span><span></span>
                <span className="text-slate-500">Min / Avg / Max</span><span className="text-slate-300 font-mono">{pingResult.result.min} / {pingResult.result.avg} / {pingResult.result.max} ms</span><span></span>
              </div>
              <p className="text-xs text-slate-500 mt-2">{pingResult.result.note} Path: {pingResult.path?.join(" → ")}</p>
              {!pingResult.result.reachable && <p className="text-xs text-red-400 mt-1">Request timed out / no route (check device status and links).</p>}
              <p className="mt-2"><SimBadge /></p>
            </div>
          )}
        </Card>

        <Card title="Traceroute" subtitle="Hop-by-hop path — simulated over topology">
          <div className="flex gap-2 items-end">
            <select className="input max-w-48" value={source} onChange={(e) => setSource(Number(e.target.value))} aria-label="Source device">
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input className="input max-w-40" placeholder="Destination IP" value={target} onChange={(e) => setTarget(e.target.value)} />
            <button className="btn-solid" disabled={!source || !target || busy === "traceroute"} onClick={() => run("traceroute")}>{busy === "traceroute" ? "Tracing…" : "Trace"}</button>
          </div>
          {traceResult?.result && (
            <div className="mt-4 text-sm">
              {!traceResult.result.reachable ? <p className="text-xs text-red-400">Destination unreachable in the modeled topology.</p> : (
                <table className="w-full text-xs">
                  <thead><tr><th className="th">Hop</th><th className="th">Device</th><th className="th">Address</th><th className="th">RTT 1/2/3</th></tr></thead>
                  <tbody>
                    {traceResult.result.hops.map((h: any) => (
                      <tr key={h.hop}><td className="td">{h.hop}</td><td className="td text-slate-300">{h.device}</td><td className="td font-mono text-slate-500">{h.ip ?? "—"}</td><td className="td font-mono text-slate-400">{h.rtt1} / {h.rtt2} / {h.rtt3} ms</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-2"><SimBadge /></p>
            </div>
          )}
        </Card>

        <Card title="DNS Lookup" subtitle="REAL query via server resolver">
          <div className="flex gap-2 items-end">
            <input className="input" placeholder="Domain (lpu.in)" value={domain} onChange={(e) => setDomain(e.target.value)} />
            <button className="btn-solid" disabled={busy === "dns"} onClick={() => run("dns", { target: domain })}>{busy === "dns" ? "Resolving…" : "Resolve"}</button>
          </div>
          {dnsResult?.result && (
            <div className="mt-4 text-sm">
              <p className="flex gap-2"><span className="text-slate-500">Domain:</span><span className="text-slate-300 font-mono">{dnsResult.result.domain}</span></p>
              <p className="flex gap-2"><span className="text-slate-500">Record type:</span><span className="text-slate-300">{dnsResult.result.recordType}</span></p>
              <p className="flex gap-2"><span className="text-slate-500">Status:</span><Badge tone={dnsResult.result.status === "NOERROR" ? "ok" : "warn"}>{dnsResult.result.status}</Badge></p>
              <div className="flex gap-2"><span className="text-slate-500">Records:</span>
                <div className="font-mono text-slate-300">{dnsResult.result.records.map((r: string, i: number) => <p key={i}>{r}</p>)}</div>
              </div>
              <p className="mt-2"><Badge tone="ok">REAL DNS</Badge></p>
            </div>
          )}
        </Card>

        <Card title="Port Check" subtitle="REAL TCP connect — common ports only (educational)">
          <div className="flex gap-2 items-end">
            <input className="input" placeholder="Host (lpu.in)" value={host} onChange={(e) => setHost(e.target.value)} />
            <button className="btn-solid" disabled={busy === "port"} onClick={() => run("port", { target: host })}>{busy === "port" ? "Checking…" : "Check ports"}</button>
          </div>
          {portResult?.result && (
            <table className="w-full mt-4 text-xs">
              <thead><tr><th className="th">Port</th><th className="th">Service</th><th className="th">State</th></tr></thead>
              <tbody>
                {portResult.result.ports.map((p: any) => (
                  <tr key={p.port}>
                    <td className="td font-mono text-slate-300">{p.port}</td><td className="td text-slate-400">{p.service}</td>
                    <td className="td"><Badge tone={p.open ? "ok" : "crit"}>{p.open ? "OPEN" : "closed/filtered"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-slate-600 mt-2">Checks 21 FTP, 22 SSH, 25 SMTP, 53 DNS, 80 HTTP, 443 HTTPS via real TCP connect from the server.</p>
        </Card>
      </div>
    </div>
  );
}
