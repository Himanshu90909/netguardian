"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Card, Empty, Loading, StatusDot, SimBadge } from "@/components/ui";
import DeviceIcon from "@/components/DeviceIcon";
import { api } from "@/lib/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Detail = {
  device: any; interfaces: any[]; metrics: any[]; links: any[];
  logs: any[]; alerts: any[];
};

const TABS = ["Overview", "Interfaces", "Metrics", "Logs", "Configuration", "Security"] as const;

export default function DeviceDetail() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [names, setNames] = useState<Record<number, string>>({});

  useEffect(() => {
    api<Detail>(`/devices/${id}`).then(async (d) => {
      setData(d);
      const map: Record<number, string> = {};
      for (const l of d.links) {
        for (const x of [l.source_device, l.destination_device]) {
          if (x !== d.device.id && !map[x]) {
            const r = await api<{ device: any }>(`/devices/${x}`).catch(() => null);
            if (r) map[x] = r.device.name;
          }
        }
      }
      setNames(map);
    }).catch(() => null);
  }, [id]);

  if (!data) return <Loading />;
  const d = data.device;
  const metrics = data.metrics.slice().reverse().map((m: any) => ({
    t: new Date(m.timestamp).toLocaleTimeString(), latency: m.latency_ms, loss: m.packet_loss,
    bw: m.bandwidth_mbps, cpu: m.cpu_usage, mem: m.memory_usage,
  }));
  const last = data.metrics[0];
  const uptime = d.uptime_s ? `${Math.floor(d.uptime_s / 86400)}d ${Math.floor((d.uptime_s % 86400) / 3600)}h` : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <DeviceIcon type={d.device_type} size={26} />
        <div>
          <h1 className="text-lg font-semibold">{d.name}</h1>
          <p className="text-xs text-slate-500">{d.device_type} · <span className="inline-flex items-center gap-1"><StatusDot status={d.status} />{d.status}</span></p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-noc-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${tab === t ? "border-noc-accent text-sky-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card title="Device information">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-slate-500">IP address</span><span className="text-slate-300">{d.ip_address ?? "—"}</span>
              <span className="text-slate-500">MAC address</span><span className="text-slate-300">{d.mac_address ?? "—"}</span>
              <span className="text-slate-500">Location</span><span className="text-slate-300">{d.location ?? "—"}</span>
              <span className="text-slate-500">Uptime</span><span className="text-slate-300">{uptime}</span>
              <span className="text-slate-500">CPU / Memory (latest)</span><span className="text-slate-300">{last ? `${last.cpu_usage}% / ${last.memory_usage}%` : "—"} <SimBadge /></span>
            </div>
          </Card>
          <Card title="Connected devices" subtitle={`${data.links.length} link(s)`}>
            {data.links.length === 0 ? <Empty title="No links" /> : (
              <ul className="space-y-1.5 text-sm">
                {data.links.map((l) => {
                  const other = l.source_device === d.id ? l.destination_device : l.source_device;
                  return (
                    <li key={l.id} className="flex items-center justify-between">
                      <span className="text-slate-300">{names[other] ?? `Device #${other}`}{l.is_trunk ? " (trunk)" : ""}</span>
                      <Badge tone={l.status === "up" ? "ok" : l.status === "warning" ? "warn" : "crit"}>{l.status}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title="Recent alerts"><AlertList alerts={data.alerts} /></Card>
          <Card title="VLAN membership" subtitle="From interface VLAN assignments">
            {data.interfaces.filter((i) => i.vlan_number).length === 0 ? <Empty title="No VLAN assigned" /> : (
              <ul className="space-y-1 text-sm">
                {data.interfaces.filter((i) => i.vlan_number).map((i) => (
                  <li key={i.id} className="text-slate-300">{i.interface_name}: VLAN {i.vlan_number}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "Interfaces" && (
        <Card title="Interfaces">
          {data.interfaces.length === 0 ? <Empty title="No interfaces configured" hint="Add interfaces from the API or seed data." /> : (
            <table className="w-full">
              <thead><tr><th className="th">Interface</th><th className="th">IP Address</th><th className="th">Subnet Mask</th><th className="th">MAC</th><th className="th">VLAN</th><th className="th">Status</th></tr></thead>
              <tbody>
                {data.interfaces.map((i) => (
                  <tr key={i.id}>
                    <td className="td font-mono text-slate-300">{i.interface_name}</td>
                    <td className="td text-slate-400">{i.ip_address ?? "—"}</td>
                    <td className="td text-slate-400">{i.subnet_mask ?? "—"}</td>
                    <td className="td text-slate-500 font-mono text-xs">{i.mac_address ?? "—"}</td>
                    <td className="td">{i.vlan_number ? <Badge tone="info">VLAN {i.vlan_number}</Badge> : "—"}</td>
                    <td className="td"><Badge tone={i.status === "up" ? "ok" : "crit"}>{i.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "Metrics" && (
        <Card title="Metric history" subtitle="Simulated telemetry (labeled) — latest first"><SimBadge />
          {metrics.length === 0 ? <Empty title="No metrics recorded" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={metrics}>
                <XAxis dataKey="t" stroke="#475569" fontSize={11} /><YAxis stroke="#475569" fontSize={11} />
                <Tooltip contentStyle={{ background: "#141c28", border: "1px solid #1e2936", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="latency" stroke="#38bdf8" dot={false} name="Latency (ms)" />
                <Line type="monotone" dataKey="loss" stroke="#fbbf24" dot={false} name="Packet loss (%)" />
                <Line type="monotone" dataKey="bw" stroke="#34d399" dot={false} name="Bandwidth (Mbps)" />
                <Line type="monotone" dataKey="cpu" stroke="#a78bfa" dot={false} name="CPU (%)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      {tab === "Logs" && <Card title="Recent logs"><LogList logs={data.logs} /></Card>}
      {tab === "Configuration" && (
        <Card title="Running configuration" subtitle="Conceptual Cisco-style configuration derived from stored data">
          <pre className="text-xs font-mono text-slate-300 bg-noc-bg rounded-md p-4 overflow-x-auto whitespace-pre-wrap">{buildConfig(d, data.interfaces)}</pre>
        </Card>
      )}
      {tab === "Security" && (
        <Card title="Security posture" subtitle="Conceptual security view for this device">
          <ul className="text-sm text-slate-400 space-y-1.5 list-disc pl-4">
            <li>{d.device_type === "Firewall" ? "Perimeter filtering device — ACL enforcement point." : "Protected by upstream ACLs and port security where applicable."}</li>
            <li>Port security entries: enforced on access ports where configured (see Security page).</li>
            <li>Device status changes, link changes and diagnostics are all logged for audit.</li>
          </ul>
        </Card>
      )}
    </div>
  );
}

function buildConfig(d: any, ifaces: any[]) {
  const lines: string[] = [`! Device: ${d.name} (${d.device_type})`];
  if (d.device_type.includes("Switch")) lines.push("spanning-tree mode rapid-pvst");
  for (const i of ifaces) {
    lines.push("!", `interface ${i.interface_name}`);
    if (i.ip_address) lines.push(` ip address ${i.ip_address} ${i.subnet_mask ?? "255.255.255.0"}`);
    if (i.vlan_number) lines.push(` switchport access vlan ${i.vlan_number}`, " switchport mode access");
  }
  return lines.join("\n");
}
function AlertList({ alerts }: { alerts: any[] }) {
  if (alerts.length === 0) return <Empty title="No alerts for this device" />;
  return <ul className="space-y-1.5 text-sm">{alerts.slice(0, 6).map((a) => (
    <li key={a.id} className="flex gap-2 items-start"><Badge tone={a.severity === "critical" ? "crit" : a.severity === "high" ? "warn" : "info"}>{a.severity}</Badge><span className="text-slate-400 text-xs">{a.message}</span></li>
  ))}</ul>;
}
function LogList({ logs }: { logs: any[] }) {
  if (logs.length === 0) return <Empty title="No logs for this device" />;
  return <div className="space-y-1 text-xs font-mono">{logs.map((l) => (
    <p key={l.id} className="text-slate-400"><span className="text-slate-600">{new Date(l.timestamp).toLocaleString()}</span> [{l.event_type}] {l.message}</p>
  ))}</div>;
}
