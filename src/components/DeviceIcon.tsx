"use client";
import { Router, Server, Monitor, Laptop, Wifi, Shield, HardDrive, Network } from "lucide-react";

export default function DeviceIcon({ type, size = 16 }: { type: string; size?: number }) {
  if (type === "Router") return <Router size={size} className="text-noc-accent" />;
  if (type === "Layer 3 Switch") return <Network size={size} className="text-violet-400" />;
  if (type === "Layer 2 Switch") return <Network size={size} className="text-emerald-400" />;
  if (type === "Server") return <Server size={size} className="text-orange-400" />;
  if (type === "PC") return <Monitor size={size} className="text-sky-400" />;
  if (type === "Laptop") return <Laptop size={size} className="text-sky-300" />;
  if (type === "Access Point") return <Wifi size={size} className="text-fuchsia-400" />;
  if (type === "Firewall") return <Shield size={size} className="text-red-400" />;
  return <HardDrive size={size} className="text-slate-400" />;
}

export const DEVICE_TYPES = ["Router", "Layer 3 Switch", "Layer 2 Switch", "Server", "PC", "Laptop", "Access Point", "Firewall"] as const;
