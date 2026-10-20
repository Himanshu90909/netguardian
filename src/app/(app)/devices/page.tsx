"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty, Loading, StatusDot } from "@/components/ui";
import DeviceIcon, { DEVICE_TYPES } from "@/components/DeviceIcon";
import { api, post, patch, del } from "@/lib/client";

type Device = { id: number; name: string; device_type: string; ip_address: string | null; status: string; location: string | null; created_at: string };

export default function Devices() {
  const { project } = useProject();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", device_type: "Router", ip_address: "", mac_address: "", location: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!project) return;
    api<{ devices: Device[] }>(`/devices?projectId=${project.id}`).then((r) => { setDevices(r.devices); setLoaded(true); }).catch(() => setLoaded(true));
  }, [project]);

  async function add() {
    try {
      await post("/devices", { project_id: project!.id, ...form, ip_address: form.ip_address || undefined, mac_address: form.mac_address || undefined, location: form.location || undefined });
      setForm({ name: "", device_type: "Router", ip_address: "", mac_address: "", location: "" }); setAdding(false); setErr("");
      const r = await api<{ devices: Device[] }>(`/devices?projectId=${project!.id}`); setDevices(r.devices);
    } catch (e: any) { setErr(e.message); }
  }

  async function toggleStatus(d: Device) {
    await patch(`/devices/${d.id}`, { status: d.status === "online" ? "offline" : "online" });
    const r = await api<{ devices: Device[] }>(`/devices?projectId=${project!.id}`); setDevices(r.devices);
  }

  if (!project) return <Empty title="Select a project first" />;
  const filtered = devices.filter((d) => (!filterType || d.device_type === filterType) && (!search || d.name.toLowerCase().includes(search.toLowerCase()) || d.ip_address?.includes(search)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Device Inventory</h1>
        <button className="btn" onClick={() => setAdding(!adding)}>{adding ? "Close" : "Add device"}</button>
      </div>
      {adding && (
        <Card title="New device">
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.device_type} onChange={(e) => setForm({ ...form, device_type: e.target.value })}>{DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <input className="input" placeholder="IP address" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
            <input className="input" placeholder="MAC address" value={form.mac_address} onChange={(e) => setForm({ ...form, mac_address: e.target.value })} />
            <input className="input" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <button className="btn-solid" onClick={add}>Add</button>
          </div>
          {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
        </Card>
      )}
      <Card>
        <div className="flex gap-2 mb-3">
          <input className="input max-w-56" placeholder="Search name or IP…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input max-w-48" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All types</option>{DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        {!loaded ? <Loading /> : filtered.length === 0 ? <Empty title="No devices found" hint="Add devices to build your network inventory." /> : (
          <table className="w-full">
            <thead><tr><th className="th">Device</th><th className="th">Type</th><th className="th">IP Address</th><th className="th">Status</th><th className="th">Location</th><th className="th">Actions</th></tr></thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-white/[0.02]">
                  <td className="td"><Link href={`/devices/${d.id}`} className="flex items-center gap-2 text-sky-300 hover:underline"><DeviceIcon type={d.device_type} />{d.name}</Link></td>
                  <td className="td text-slate-400">{d.device_type}</td>
                  <td className="td text-slate-400">{d.ip_address ?? "—"}</td>
                  <td className="td"><span className="inline-flex items-center gap-1.5"><StatusDot status={d.status} />{d.status}</span></td>
                  <td className="td text-slate-500">{d.location ?? "—"}</td>
                  <td className="td">
                    <div className="flex gap-2 text-xs">
                      <button className="btn" onClick={() => toggleStatus(d)}>{d.status === "online" ? "Set offline" : "Set online"}</button>
                      <button className="text-red-400 hover:underline" onClick={async () => { if (confirm(`Delete ${d.name}?`)) { await del(`/devices/${d.id}`); setDevices((ds) => ds.filter((x) => x.id !== d.id)); } }}>Delete</button>
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
