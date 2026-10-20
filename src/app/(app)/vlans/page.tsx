"use client";
import { useEffect, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty, Loading } from "@/components/ui";
import { api, post, del } from "@/lib/client";

type Vlan = { id: number; vlan_id: number; name: string; subnet: string | null; gateway: string | null };
type Iface = { id: number; device_id: number; vlan_number: number | null; interface_name: string };
type Device = { id: number; name: string };

export default function Vlans() {
  const { project } = useProject();
  const [vlans, setVlans] = useState<Vlan[]>([]);
  const [ifaces, setIfaces] = useState<Iface[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [form, setForm] = useState({ vlan_id: "", name: "", subnet: "", gateway: "" });
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (!project) return;
    const v = await api<{ vlans: Vlan[] }>(`/vlans?projectId=${project.id}`);
    const d = await api<{ devices: Device[] }>(`/devices?projectId=${project.id}`);
    const allIf = await Promise.all(d.devices.map((x) => api<{ interfaces: Iface[] }>(`/interfaces?deviceId=${x.id}`).catch(() => ({ interfaces: [] }))));
    setVlans(v.vlans); setDevices(d.devices); setInterfacesSafe(allIf.flatMap((r) => r.interfaces));
    setLoaded(true);
  }
  function setInterfacesSafe(x: Iface[]) { setIfaces(x); }
  useEffect(() => { load(); }, [project]);

  async function add() {
    try {
      await post("/vlans", { project_id: project!.id, vlan_id: Number(form.vlan_id), name: form.name, subnet: form.subnet || undefined, gateway: form.gateway || undefined });
      setForm({ vlan_id: "", name: "", subnet: "", gateway: "" }); setErr(""); await load();
    } catch (e: any) { setErr(e.message); }
  }

  if (!project) return <Empty title="Select a project first" />;
  const colors = ["#38bdf8", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#f472b6", "#2dd4bf", "#f97316"];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">VLAN Management</h1>
      <p className="text-xs text-slate-500 -mt-2">IEEE 802.1Q virtual LANs — each VLAN is a separate broadcast domain. Inter-VLAN routing happens at the Layer-3 switch SVIs.</p>

      <Card title="Create VLAN">
        <div className="grid sm:grid-cols-5 gap-3 items-end">
          <input className="input" placeholder="VLAN ID (1-4094)" value={form.vlan_id} onChange={(e) => setForm({ ...form, vlan_id: e.target.value })} />
          <input className="input" placeholder="Name (e.g. Students)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Subnet (e.g. 10.10.1.0/24)" value={form.subnet} onChange={(e) => setForm({ ...form, subnet: e.target.value })} />
          <input className="input" placeholder="Gateway" value={form.gateway} onChange={(e) => setForm({ ...form, gateway: e.target.value })} />
          <button className="btn-solid" onClick={add}>Create</button>
        </div>
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
      </Card>

      {!loaded ? <Loading /> : vlans.length === 0 ? <Card><Empty title="No VLANs yet" hint="Create VLANs above or load the sample project which includes VLANs 10/20/30/40/50." /></Card> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vlans.map((v, idx) => {
            const members = ifaces.filter((i) => i.vlan_number === v.vlan_id);
            return (
              <Card key={v.id} className="!p-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold" style={{ background: `${colors[idx % colors.length]}22`, color: colors[idx % colors.length] }}>
                      {v.vlan_id}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{v.name}</p>
                      <p className="text-[10px] text-slate-500">VLAN {v.vlan_id}</p>
                    </div>
                  </div>
                  <button className="text-xs text-red-400 hover:underline" onClick={async () => { if (confirm(`Delete VLAN ${v.vlan_id}?`)) { await del(`/vlans/${v.id}`); await load(); } }}>Delete</button>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">Network</span><span className="text-slate-300 font-mono">{v.subnet ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Gateway (SVI)</span><span className="text-slate-300 font-mono">{v.gateway ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Interfaces</span><span className="text-slate-300">{members.length}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-noc-border">
                  <p className="text-[10px] text-slate-600 mb-1.5">Broadcast isolation — traffic stays within VLAN {v.vlan_id} unless routed:</p>
                  <div className="flex flex-wrap gap-1">
                    {members.slice(0, 8).map((m) => (
                      <Badge key={m.id} tone="default">{devices.find((d) => d.id === m.device_id)?.name ?? "?"} · {m.interface_name}</Badge>
                    ))}
                    {members.length === 0 && <span className="text-[11px] text-slate-600">No interfaces assigned</span>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card title="How VLAN isolation works here" subtitle="Conceptual explanation">
        <ul className="text-sm text-slate-400 space-y-1.5 list-disc pl-4">
          <li>Each VLAN = separate broadcast domain (switch does not forward frames between VLANs).</li>
          <li>Links carrying multiple VLANs are marked as <span className="text-violet-400">802.1Q trunks</span> in the topology.</li>
          <li>Inter-VLAN routing is performed by the Layer-3 switch SVIs (Vlan10, Vlan20… interfaces on CORE-SW-01 in the sample).</li>
          <li>ACLs on the Security page can restrict traffic between VLANs (e.g. Guest → servers).</li>
        </ul>
      </Card>
    </div>
  );
}
