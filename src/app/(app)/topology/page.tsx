"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, StatusDot, Loading, Empty } from "@/components/ui";
import DeviceIcon, { DEVICE_TYPES } from "@/components/DeviceIcon";
import { api, post, patch, del } from "@/lib/client";

type Device = { id: number; name: string; device_type: string; ip_address: string | null; mac_address: string | null; status: string; location: string | null; x: number; y: number };
type Link = { id: number; source_device: number; destination_device: number; source_interface: string | null; destination_interface: string | null; status: string; is_trunk: boolean };

export default function Topology() {
  const { project } = useProject();
  const [devices, setDevices] = useState<Device[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Device | null>(null);
  const [connecting, setConnecting] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", device_type: "PC", ip_address: "", location: "" });
  const [err, setErr] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);

  const load = useCallback(async () => {
    if (!project) return;
    const { devices, links } = await api(`/topology?projectId=${project.id}`);
    setDevices(devices); setLinks(links); setLoaded(true);
  }, [project]);

  useEffect(() => { if (project) load(); }, [project, load]);

  const persistPos = async (id: number, x: number, y: number) => {
    await patch(`/devices/${id}`, { x, y }).catch(() => null);
  };

  function onMouseDown(e: React.MouseEvent, d: Device) {
    const rect = svgRef.current!.getBoundingClientRect();
    drag.current = { id: d.id, dx: e.clientX - rect.left - d.x, dy: e.clientY - rect.top - d.y };
    setSelected(d);
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drag.current) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const x = Math.max(10, Math.min(e.clientX - rect.left - drag.current.dx, 860));
    const y = Math.max(10, Math.min(e.clientY - rect.top - drag.current.dy, 560));
    setDevices((ds) => ds.map((d) => (d.id === drag.current!.id ? { ...d, x, y } : d)));
  }
  function onMouseUp() {
    if (drag.current) {
      const d = devices.find((x) => x.id === drag.current!.id);
      if (d) persistPos(d.id, d.x, d.y);
      drag.current = null;
    }
  }

  async function handleNodeClick(d: Device) {
    if (connecting !== null) {
      if (connecting === d.id) { setConnecting(null); return; }
      try {
        await post("/topology/links", { project_id: project!.id, source_device: connecting, destination_device: d.id });
        await load(); setErr("");
      } catch (e: any) { setErr(e.message); }
      setConnecting(null);
    } else setSelected(d);
  }

  async function addDevice() {
    if (!form.name.trim()) { setErr("Device name required"); return; }
    try {
      const x = 80 + Math.random() * 720, y = 60 + Math.random() * 420;
      await post("/devices", { project_id: project!.id, name: form.name, device_type: form.device_type, ip_address: form.ip_address || undefined, location: form.location || undefined, x, y });
      setForm({ name: "", device_type: "PC", ip_address: "", location: "" }); setAdding(false); setErr(""); await load();
    } catch (e: any) { setErr(e.message); }
  }

  async function deleteDevice(id: number) {
    if (!confirm("Delete this device and all its links/interfaces?")) return;
    await del(`/devices/${id}`); setSelected(null); await load();
  }

  if (!project) return <Empty title="Create or select a project first" hint="Projects page → New project, or load the sample." />;
  if (!loaded) return <Loading label="Loading topology" />;

  const devById = (id: number) => devices.find((d) => d.id === id);
  const linkColor = (s: string) => (s === "up" ? "#34d399" : s === "warning" ? "#fbbf24" : "#f87171");
  const dash = (s: string) => (s === "down" ? "6 6" : undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Network Topology</h1>
          <p className="text-xs text-slate-500">Drag nodes to arrange · click a node for details · Connect mode joins two devices with a link</p>
        </div>
        <div className="flex gap-2">
          {connecting !== null && <span className="text-xs text-noc-warn self-center">Connecting from {devById(connecting)?.name} — click target device</span>}
          <button className="btn" onClick={() => setConnecting(null)} style={{ visibility: connecting !== null ? "visible" : "hidden" }}>Cancel connect</button>
          <button className="btn" onClick={() => setAdding(!adding)}>{adding ? "Close" : "Add device"}</button>
        </div>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}

      {adding && (
        <Card title="Add device">
          <div className="grid sm:grid-cols-4 gap-3">
            <input className="input" placeholder="Name (e.g. RTR-01)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.device_type} onChange={(e) => setForm({ ...form, device_type: e.target.value })}>
              {DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input className="input" placeholder="IP (optional)" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
            <div className="flex gap-2">
              <input className="input" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <button className="btn-solid" onClick={addDevice}>Add</button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <Card>
          <svg ref={svgRef} width="100%" viewBox="0 0 880 580" style={{ maxHeight: 580 }}
            onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
            <defs>
              <marker id="arrowup" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#34d399" /></marker>
            </defs>
            {links.map((l) => {
              const a = devById(l.source_device), b = devById(l.destination_device);
              if (!a || !b) return null;
              return (
                <g key={l.id}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={linkColor(l.status)} strokeWidth={l.is_trunk ? 3 : 1.8} strokeDasharray={dash(l.status)} opacity={l.status === "down" ? 0.45 : 0.85} />
                  {l.is_trunk && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} fill="#a78bfa" fontSize="9" textAnchor="middle">802.1Q trunk</text>}
                </g>
              );
            })}
            {devices.map((d) => (
              <g key={d.id} transform={`translate(${d.x},${d.y})`}
                onMouseDown={(e) => onMouseDown(e, d)} onClick={() => handleNodeClick(d)} style={{ cursor: "grab" }}>
                <circle r="22" fill="#141c28" stroke={selected?.id === d.id ? "#38bdf8" : d.status === "offline" ? "#f87171" : "#1e2936"} strokeWidth={selected?.id === d.id ? 2.5 : 1.5} />
                <circle r="3" cy="-14" fill={d.status === "online" ? "#34d399" : d.status === "warning" ? "#fbbf24" : "#f87171"} className={d.status === "online" ? "animate-pulse" : ""} />
                <foreignObject x="-11" y="-11" width="22" height="22"><div className="flex items-center justify-center w-full h-full"><DeviceIconWrap type={d.device_type} /></div></foreignObject>
                <text y="38" fontSize="11" fill="#cbd5e1" textAnchor="middle">{d.name}</text>
                <text y="50" fontSize="9" fill="#64748b" textAnchor="middle">{d.ip_address ?? "no IP"}</text>
              </g>
            ))}
          </svg>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span><span className="inline-block w-2 h-2 rounded-full bg-noc-ok mr-1" />online</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-noc-warn mr-1" />warning</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-noc-crit mr-1" />offline/down</span>
            <span className="text-violet-400">─ thick purple = 802.1Q trunk</span>
            <span>dashed = link down</span>
          </div>
        </Card>

        <div className="space-y-4">
          {selected ? (
            <Card title={selected.name} subtitle={selected.device_type} actions={
              <button className="text-xs text-red-400 hover:underline" onClick={() => deleteDevice(selected.id)}>Delete</button>
            }>
              <div className="space-y-2 text-sm">
                <Row k="Status"><StatusDot status={selected.status} /> {selected.status}</Row>
                <Row k="IP address">{selected.ip_address ?? "—"}</Row>
                <Row k="MAC address">{selected.mac_address ?? "—"}</Row>
                <Row k="Location">{selected.location ?? "—"}</Row>
                <Row k="Links">
                  <div className="flex flex-wrap gap-1">
                    {links.filter((l) => l.source_device === selected.id || l.destination_device === selected.id).map((l) => {
                      const other = devById(l.source_device === selected.id ? l.destination_device : l.source_device);
                      return (
                        <span key={l.id} className="inline-flex items-center gap-1">
                          <Badge tone={l.status === "up" ? "ok" : l.status === "warning" ? "warn" : "crit"}>{other?.name}{l.is_trunk ? " (trunk)" : ""}</Badge>
                          <button className="text-[10px] text-slate-500 hover:text-red-400" onClick={async () => { await del(`/topology/links/${l.id}`); await load(); }}>✕</button>
                        </span>
                      );
                    })}
                  </div>
                </Row>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="btn" onClick={() => setConnecting(selected.id)}>Connect to…</button>
                <a className="btn" href={`/devices/${selected.id}`}>Details</a>
              </div>
            </Card>
          ) : (
            <Card title="Device details"><Empty title="Click a device to inspect it" /></Card>
          )}
          <Card title="Connectivity tips">
            <ul className="text-xs text-slate-500 list-disc pl-4 space-y-1">
              <li>Drag nodes to lay out the campus design (positions persist).</li>
              <li>Use “Connect to…” then click a second device to create a link.</li>
              <li>Simulate failures from the Anomaly/Diagnostics pages — link colors update live.</li>
              <li>This is a modeled topology (educational), not live SNMP discovery.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><span className="text-slate-500">{k}</span><span className="text-slate-300 text-right">{children}</span></div>;
}
function DeviceIconWrap({ type }: { type: string }) {
  return <span style={{ display: "flex" }}><DeviceIcon type={type} size={17} /></span>;
}
