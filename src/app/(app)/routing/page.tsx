"use client";
import { useEffect, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty, Loading } from "@/components/ui";
import { api, post, del } from "@/lib/client";

type Route = { id: number; destination: string; subnet_mask: string; next_hop: string | null; interface_name: string | null; protocol: string; metric: number };
type Vlan = { id: number; vlan_id: number; name: string; subnet: string | null; gateway: string | null };
type Device = { id: number; name: string; device_type: string; ip_address: string | null; status: string };

export default function Routing() {
  const { project } = useProject();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [form, setForm] = useState({ destination: "", subnet_mask: "255.255.255.0", next_hop: "", interface_name: "", protocol: "static", metric: "1" });
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sim, setSim] = useState<string>("");

  async function load() {
    if (!project) return;
    const r = await api<{ routes: Route[] }>(`/routes?projectId=${project.id}`);
    const d = await api<{ devices: Device[] }>(`/devices?projectId=${project.id}`);
    setRoutes(r.routes); setDevices(d.devices); setLoaded(true);
  }
  useEffect(() => { load(); }, [project]);

  async function add() {
    try {
      await post("/routes", { project_id: project!.id, destination: form.destination, subnet_mask: form.subnet_mask, next_hop: form.next_hop || undefined, interface_name: form.interface_name || undefined, protocol: form.protocol, metric: Number(form.metric) });
      setForm({ ...form, destination: "", next_hop: "", interface_name: "" }); setErr(""); await load();
    } catch (e: any) { setErr(e.message); }
  }

  function simulateFailover() {
    const routers = devices.filter((d) => d.device_type === "Router" || d.device_type === "Layer 3 Switch");
    if (routers.length === 0) { setSim("Add a router or L3 switch first."); return; }
    setSim(
      `Conceptual failover: if the primary next hop becomes unreachable, dynamic protocols (OSPF/RIP) detect the loss of adjacency after dead-timer expiry (OSPF: 40s, or sub-second with BFD), " +
      "flush affected prefixes from the RIB, and re-run SPF/Dijkstra over the remaining topology. An alternate path with the next-lowest cost is installed. " +
      "Try it live: simulate a device failure on the Anomaly or Diagnostics page, then re-check reachability with a simulated ping — the path recalculates over surviving links.`
    );
  }

  if (!project) return <Empty title="Select a project first" />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Routing</h1>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Static Routing" subtitle="Manually configured next hops">
          <p className="text-xs text-slate-400">Static routes have administrative distance 1 — highest trust, no automatic recovery. Used for the default route to the ISP in the sample network.</p>
        </Card>
        <Card title="RIP" subtitle="Distance-vector (hop count, max 15)">
          <p className="text-xs text-slate-400">RIP broadcasts its table every 30s; count-to-infinity prevented by split horizon. Suitable only for small, stable networks.</p>
        </Card>
        <Card title="OSPF" subtitle="Link-state (Dijkstra SPF, cost-based)">
          <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
            <li>Router ID: highest loopback or configured value</li>
            <li>Area: sample uses Area 0 (backbone)</li>
            <li>Neighbor states: DOWN → INIT → 2-WAY → EXSTART → FULL</li>
            <li>Cost = reference bandwidth / interface bandwidth</li>
          </ul>
        </Card>
      </div>

      <Card title="Add route">
        <div className="grid sm:grid-cols-7 gap-3 items-end">
          <input className="input" placeholder="Destination (10.60.0.0)" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          <input className="input" placeholder="Mask" value={form.subnet_mask} onChange={(e) => setForm({ ...form, subnet_mask: e.target.value })} />
          <input className="input" placeholder="Next hop" value={form.next_hop} onChange={(e) => setForm({ ...form, next_hop: e.target.value })} />
          <input className="input" placeholder="Interface" value={form.interface_name} onChange={(e) => setForm({ ...form, interface_name: e.target.value })} />
          <select className="input" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
            <option value="static">static</option><option value="ospf">ospf</option><option value="rip">rip</option><option value="connected">connected</option>
          </select>
          <input className="input" placeholder="Metric" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} />
          <button className="btn-solid" onClick={add}>Add</button>
        </div>
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
      </Card>

      {!loaded ? <Loading /> : (
        <Card title="Routing table" subtitle={`${routes.length} prefixes`}>
          {routes.length === 0 ? <Empty title="No routes configured" /> : (
            <table className="w-full">
              <thead><tr><th className="th">Destination</th><th className="th">Subnet Mask</th><th className="th">Next Hop</th><th className="th">Interface</th><th className="th">Metric</th><th className="th">Protocol</th><th className="th"></th></tr></thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id}>
                    <td className="td font-mono text-slate-300">{r.destination}</td>
                    <td className="td font-mono text-slate-500">{r.subnet_mask}</td>
                    <td className="td font-mono text-slate-400">{r.next_hop ?? "—"}</td>
                    <td className="td font-mono text-slate-400">{r.interface_name ?? "—"}</td>
                    <td className="td text-slate-400">{r.metric}</td>
                    <td className="td"><Badge tone={r.protocol === "ospf" ? "info" : r.protocol === "static" ? "default" : "ok"}>{r.protocol}</Badge></td>
                    <td className="td"><button className="text-xs text-red-400 hover:underline" onClick={async () => { await del(`/routes/${r.id}`); await load(); }}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Card title="Simulate route change" subtitle="Conceptual demonstration of alternate-path selection">
        <button className="btn" onClick={simulateFailover}>Explain OSPF reconvergence</button>
        {sim && <p className="text-sm text-slate-400 mt-3 leading-relaxed">{sim}</p>}
      </Card>
    </div>
  );
}
