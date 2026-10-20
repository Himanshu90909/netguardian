"use client";
import { useSession } from "next-auth/react";
import { Card, Badge } from "@/components/ui";

export default function Settings() {
  const { data: session } = useSession();
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-lg font-semibold">Settings &amp; Profile</h1>
      <Card title="Profile">
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-full bg-noc-accent/20 text-noc-accent flex items-center justify-center text-xl font-bold">
            {(session?.user?.name ?? "U").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-200">{session?.user?.name}</p>
            <p className="text-xs text-slate-500">{session?.user?.email}</p>
            <p className="text-xs text-slate-600 mt-1">All your projects, devices, logs and reports are scoped to this account (row-level ownership enforced server-side).</p>
          </div>
        </div>
      </Card>
      <Card title="About NetGuardian">
        <p className="text-sm text-slate-400">NetGuardian is an educational Network Operations Center platform demonstrating VLANs, subnetting, routing (static/RIP/OSPF), DHCP, DNS, ACLs, port security, STP concepts, monitoring, fault detection, topology visualization, explainable anomaly detection and security monitoring — with a PostgreSQL backend and simulated telemetry (clearly labeled).</p>
        <div className="flex gap-2 mt-3">
          <Badge tone="info">Simulated metrics are labeled SIMULATED</Badge>
          <Badge tone="ok">DNS &amp; Port checks are REAL</Badge>
        </div>
      </Card>
    </div>
  );
}
