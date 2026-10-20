"use client";
import { useEffect, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty, Loading } from "@/components/ui";
import { api } from "@/lib/client";

type Log = { id: number; event_type: string; message: string; timestamp: string; device_name: string | null };
type Device = { id: number; name: string };

export default function Logs() {
  const { project } = useProject();
  const [logs, setLogs] = useState<Log[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!project) return;
    const q = new URLSearchParams({ projectId: String(project.id) });
    if (search) q.set("search", search);
    if (type) q.set("type", type);
    if (deviceId) q.set("deviceId", deviceId);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    api<{ logs: Log[] }>(`/logs?${q}`).then((r) => { setLogs(r.logs); setLoaded(true); });
    api<{ devices: Device[] }>(`/devices?projectId=${project.id}`).then((r) => setDevices(r.devices));
  }, [project, search, type, deviceId, from, to]);

  if (!project) return <Empty title="Select a project first" />;
  const TYPES = [...new Set(logs.map((l) => l.event_type))];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Network Event Logs</h1>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-56" placeholder="Search messages…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input max-w-40" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All event types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input max-w-40" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">All devices</option>
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input type="date" className="input max-w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" className="input max-w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>
      <Card subtitle={`${logs.length} events`}>
        {!loaded ? <Loading /> : logs.length === 0 ? <Empty title="No log events found" /> : (
          <div className="space-y-1 max-h-[70vh] overflow-y-auto font-mono text-xs">
            {logs.map((l) => (
              <p key={l.id} className="text-slate-400 flex gap-2 flex-wrap">
                <span className="text-slate-600 shrink-0">{new Date(l.timestamp).toLocaleString()}</span>
                <Badge tone="default">{l.event_type}</Badge>
                <span>{l.message}</span>
                {l.device_name && <span className="text-slate-600">[{l.device_name}]</span>}
              </p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
