"use client";
import { useEffect, useState } from "react";
import { useProject } from "@/components/ProjectContext";
import { Badge, Card, Empty, Loading } from "@/components/ui";
import { api } from "@/lib/client";

type Iface = { id: number; device_id: number; interface_name: string; ip_address: string | null; subnet_mask: string | null; vlan_number: number | null; status: string };
type Device = { id: number; name: string; device_type: string; ip_address: string | null; project_id: number };

function calc(ip: string, cidr: number) {
  const ipToI = (s: string) => s.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
  const iToIp = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
  if (!ipToI) return null;
  const mask = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
  const base = ipToI(ip) & mask;
  const total = 2 ** (32 - cidr);
  return {
    network: iToIp(base), broadcast: iToIp(base + total - 1), mask: iToIp(mask),
    first: cidr >= 31 ? iToIp(base) : iToIp(base + 1),
    last: cidr >= 31 ? iToIp(base + total - 1) : iToIp(base + total - 2),
    usable: cidr >= 31 ? (cidr === 32 ? 0 : 2) : total - 2, total,
  };
}

export default function Ipam() {
  const { project } = useProject();
  const [devices, setDevices] = useState<Device[]>([]);
  const [interfaces, setInterfaces] = useState<Iface[]>([]);
  const [ip, setIp] = useState("192.168.10.0");
  const [cidr, setCidr] = useState(24);
  const [info, setInfo] = useState<ReturnType<typeof calc> | null>(null);

  useEffect(() => {
    if (!project) return;
    api<{ devices: Device[] }>(`/devices?projectId=${project.id}`).then((r) => {
      setDevices(r.devices);
      return Promise.all(r.devices.map((d) => api<{ interfaces: Iface[] }>(`/interfaces?deviceId=${d.id}`)));
    }).then((all) => {
      setInterfaces(all.flatMap((r) => r.interfaces));
    }).catch(() => null);
  }, [project]);

  useEffect(() => { setInfo(calc(ip, cidr)); }, [ip, cidr]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">IP Address Management</h1>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Subnet calculator" subtitle="IPv4 CIDR — supports /16 to /30 (and more)">
          <div className="flex gap-2 items-end">
            <input className="input max-w-44" value={ip} onChange={(e) => setIp(e.target.value)} aria-label="Network address" />
            <span className="text-slate-500">/</span>
            <select className="input max-w-20" value={cidr} onChange={(e) => setCidr(Number(e.target.value))} aria-label="Prefix length">
              {Array.from({ length: 32 }, (_, i) => i + 1).filter((n) => n >= 8).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {info ? (
            <div className="grid grid-cols-2 gap-y-2 mt-4 text-sm">
              <span className="text-slate-500">Network address</span><span className="text-slate-300 font-mono">{info.network}</span>
              <span className="text-slate-500">Broadcast address</span><span className="text-slate-300 font-mono">{info.broadcast}</span>
              <span className="text-slate-500">Subnet mask</span><span className="text-slate-300 font-mono">{info.mask} (/{cidr})</span>
              <span className="text-slate-500">Usable host range</span><span className="text-slate-300 font-mono">{info.first} – {info.last}</span>
              <span className="text-slate-500">Usable hosts</span><span className="text-slate-300">{info.usable.toLocaleString()}</span>
              <span className="text-slate-500">Total addresses</span><span className="text-slate-300">{info.total.toLocaleString()}</span>
            </div>
          ) : <p className="text-xs text-red-400 mt-2">Enter a valid IPv4 network address (e.g. 192.168.10.0).</p>}
          <p className="text-[11px] text-slate-600 mt-3">Concepts: subnetting (RFC 950), CIDR (RFC 4632), network/broadcast addresses, host bits.</p>
        </Card>

        <Card title="DHCP scope (conceptual)" subtitle="Derived from the /24 you calculate">
          {info && cidr >= 24 && cidr <= 30 ? (
            <div className="text-sm space-y-1.5">
              <Row k="Pool range" v={`${info.first} – ${info.last}`} />
              <Row k="Default gateway" v={info.first} />
              <Row k="DNS servers" v="10.40.0.11, 8.8.8.8" />
              <Row k="Lease duration" v="8 hours" />
              <Row k="Excluded addresses" v=".1 (gateway), .255 (broadcast)" />
              <p className="text-[11px] text-slate-600 mt-2">DHCP DORA — Discover, Offer, Request, Acknowledge — demonstrated in network logs on sample data.</p>
            </div>
          ) : <Empty title="Calculate a /24 to /30 subnet to view the DHCP scope" />}
        </Card>
      </div>

      <Card title="Assigned IP inventory" subtitle="All interfaces across this project">
        {interfaces.length === 0 ? <Empty title="No interfaces configured yet" hint="Interfaces come from seeded sample data or the API." /> : (
          <table className="w-full">
            <thead><tr><th className="th">Device</th><th className="th">Interface</th><th className="th">IP Address</th><th className="th">Subnet Mask</th><th className="th">VLAN</th><th className="th">Status</th></tr></thead>
            <tbody>
              {interfaces.map((i) => {
                const dev = devices.find((d) => d.id === i.device_id);
                return (
                  <tr key={i.id}>
                    <td className="td text-slate-300">{dev?.name ?? `#${i.device_id}`}</td>
                    <td className="td font-mono text-slate-400">{i.interface_name}</td>
                    <td className="td font-mono text-slate-300">{i.ip_address ?? "—"}</td>
                    <td className="td font-mono text-slate-500">{i.subnet_mask ?? "—"}</td>
                    <td className="td">{i.vlan_number ? <Badge tone="info">{i.vlan_number}</Badge> : "—"}</td>
                    <td className="td"><Badge tone={i.status === "up" ? "ok" : "crit"}>{i.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{k}</span><span className="text-slate-300 font-mono">{v}</span></div>;
}
