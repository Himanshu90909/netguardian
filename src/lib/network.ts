// Core networking logic — subnetting, graph connectivity, simulated diagnostics,
// explainable anomaly detection. Educational implementations of real protocols.

export type DeviceRow = {
  id: number; project_id: number; name: string; device_type: string;
  ip_address: string | null; mac_address: string | null; status: string;
  location: string | null; x: number; y: number; uptime_s: number;
};
export type LinkRow = {
  id: number; project_id: number; source_device: number; destination_device: number;
  source_interface: string | null; destination_interface: string | null;
  status: string; is_trunk: boolean;
};

// ---------------- Subnetting (IPv4) ----------------
export function ipToInt(ip: string): number {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}
export function intToIp(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
}
export function maskFromCidr(cidr: number): number {
  return cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
}
export function cidrFromMask(mask: string): number {
  return ipToInt(mask).toString(2).split("1").length - 1;
}
export function subnetInfo(input: string) {
  const m = input.trim().match(/^(?:\/?(\d{1,2}))$|^(\d{1,3}(?:\.\d{1,3}){0,3})\/(\d{1,2})$/);
  if (!m) throw new Error("Invalid CIDR — use format like 192.168.10.0/24 or /24");
  let ip = "0.0.0.0";
  let cidr: number;
  if (m[1]) { cidr = Number(m[1]); ip = "0.0.0.0"; }
  else { ip = m[2]; cidr = Number(m[3]); }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) ip = `${ip}.0.0.0`.split(".").slice(0, 4).join(".");
  if (cidr < 0 || cidr > 32) throw new Error("CIDR must be between /0 and /32");
  const mask = maskFromCidr(cidr);
  const base = ipToInt(ip) & mask;
  const total = cidr >= 31 ? 2 ** (32 - cidr) : 2 ** (32 - cidr);
  const usable = cidr >= 31 ? (cidr === 32 ? 0 : 2) : Math.max(total - 2, 0);
  return {
    cidr,
    networkAddress: intToIp(base),
    broadcastAddress: intToIp(base + total - 1),
    subnetMask: intToIp(mask),
    wildcardMask: intToIp(~mask >>> 0),
    firstHost: cidr >= 31 ? intToIp(base) : intToIp(base + 1),
    lastHost: cidr >= 31 ? intToIp(base + total - 1) : intToIp(base + total - 2),
    usableHosts: usable,
    totalHosts: total,
    ipClass: base < 0x80000000 ? "A" : base < 0xC0000000 ? "B" : base < 0xE0000000 ? "C" : "D/E",
    isPrivate: (base >>> 24) === 10 || ((base >>> 20) & 0xFF0) === 0xAC1 || ((base >>> 16) & 0xFFFF) === 0xC0A8,
  };
}

// ---------------- Graph connectivity (fault tolerance) ----------------
export function adjacency(devices: DeviceRow[], links: LinkRow[]) {
  const adj = new Map<number, number[]>();
  devices.forEach((d) => adj.set(d.id, []));
  links.forEach((l) => {
    if (l.status !== "down" && adj.has(l.source_device) && adj.has(l.destination_device)) {
      adj.get(l.source_device)!.push(l.destination_device);
      adj.get(l.destination_device)!.push(l.source_device);
    }
  });
  return adj;
}
export function bfsPath(adj: Map<number, number[]>, src: number, dst: number): number[] | null {
  if (src === dst) return [src];
  const prev = new Map<number, number>();
  const q = [src];
  const seen = new Set([src]);
  while (q.length) {
    const cur = q.shift()!;
    for (const nb of adj.get(cur) ?? []) {
      if (seen.has(nb)) continue;
      seen.add(nb); prev.set(nb, cur);
      if (nb === dst) {
        const path = [nb];
        let p = cur;
        while (p !== src) { path.unshift(p); p = prev.get(p)!; }
        path.unshift(src);
        return path;
      }
      q.push(nb);
    }
  }
  return null;
}
export function reachableFrom(adj: Map<number, number[]>, src: number): Set<number> {
  const seen = new Set<number>([src]);
  const q = [src];
  while (q.length) {
    const cur = q.shift()!;
    for (const nb of adj.get(cur) ?? []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
  }
  return seen;
}
export function deviceById(devices: DeviceRow[], id: number) {
  return devices.find((d) => d.id === id);
}

// ---------------- Simulated ping / traceroute ----------------
// Ping and traceroute are SIMULATED over the modeled topology (educational),
// clearly labeled as such. Latency derives from hop count and device status.
export function simPing(path: number[] | null, devices: DeviceRow[], dstIp: string) {
  if (!path || path.length === 0)
    return { reachable: false, packetsSent: 4, packetsReceived: 0, packetLoss: 100,
      min: 0, avg: 0, max: 0, note: "No route to host in the modeled topology.",
      simulated: true };
  const hops = path.length - 1;
  const base = 0.4 + hops * 0.6;
  const jitter = () => Math.random() * base * 0.4;
  const samples = Array.from({ length: 4 }, () => +(base + jitter()).toFixed(2));
  const loss = Math.random() < 0.06 ? 25 : 0;
  const received = 4 - (loss ? 1 : 0);
  const arr = received ? samples.slice(0, received) : samples;
  return {
    reachable: true, packetsSent: 4, packetsReceived: received, packetLoss: loss,
    min: Math.min(...arr), avg: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2),
    max: Math.max(...arr), note: `ICMP echo replied from ${dstIp} over ${hops} modeled hop(s).`,
    simulated: true,
  };
}
export function simTraceroute(path: number[] | null, devices: DeviceRow[], dstIp: string) {
  if (!path) return { reachable: false, hops: [], simulated: true };
  const hops = path.map((id, i) => {
    const d = deviceById(devices, id);
    const rtt = +(0.4 + (i + 1) * 0.6).toFixed(2);
    return { hop: i + 1, device: d?.name ?? `hop-${i + 1}`, ip: i === path.length - 1 ? dstIp : d?.ip_address ?? null, rtt1: rtt, rtt2: +(rtt * 1.05).toFixed(2), rtt3: +(rtt * 0.98).toFixed(2) };
  });
  return { reachable: true, hops, simulated: true };
}

// ---------------- Explainable anomaly detection ----------------
export type MetricRow = {
  device_id: number; latency_ms: number | null; packet_loss: number | null;
  bandwidth_mbps: number | null; cpu_usage: number | null; memory_usage: number | null;
  connection_count: number | null; timestamp: string;
};
export type Anomaly = {
  device_id: number; metric: string; expected: number; observed: number;
  deviationPct: number; riskScore: number; reason: string; deviceName?: string;
};

function stats(vals: number[]) {
  const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1));
  return { mean, sd };
}
export function detectAnomalies(devices: DeviceRow[], metrics: MetricRow[], window = 24): Anomaly[] {
  const out: Anomaly[] = [];
  const byDevice = new Map<number, MetricRow[]>();
  metrics.forEach((m) => {
    if (!byDevice.has(m.device_id)) byDevice.set(m.device_id, []);
    byDevice.get(m.device_id)!.push(m);
  });
  const METRICS: { key: keyof MetricRow; label: string; z: number }[] = [
    { key: "latency_ms", label: "latency", z: 2.5 },
    { key: "packet_loss", label: "packet_loss", z: 2 },
    { key: "bandwidth_mbps", label: "bandwidth", z: 2.5 },
    { key: "connection_count", label: "connection_count", z: 2.5 },
    { key: "cpu_usage", label: "cpu_usage", z: 2.5 },
    { key: "memory_usage", label: "memory_usage", z: 2.5 },
  ];
  for (const [devId, rows] of byDevice) {
    const sorted = rows.slice().sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
    if (sorted.length < 6) continue;
    const recent = sorted[sorted.length - 1];
    const hist = sorted.slice(Math.max(0, sorted.length - 1 - window * 4), sorted.length - 1);
    const dev = devices.find((d) => d.id === devId);
    for (const m of METRICS) {
      const vals = hist.map((r) => Number(r[m.key] ?? 0)).filter((v) => Number.isFinite(v));
      if (vals.length < 5) continue;
      const { mean, sd } = stats(vals);
      const observed = Number(recent[m.key] ?? 0);
      const sdFloor = Math.max(sd, mean * 0.05, 0.01);
      const z = Math.abs(observed - mean) / sdFloor;
      if (z >= m.z) {
        const deviationPct = mean !== 0 ? Math.round(((observed - mean) / Math.abs(mean)) * 100) : Math.round(observed * 100);
        const riskScore = Math.min(100, Math.round(z * 25));
        out.push({
          device_id: devId, metric: m.label, expected: +mean.toFixed(2), observed: +observed.toFixed(2),
          deviationPct, riskScore,
          reason: `${m.label.replace("_", " ")} of ${observed.toFixed(1)} deviates ${z.toFixed(1)}σ from the device baseline (${mean.toFixed(1)} ± ${sdFloor.toFixed(2)}).`,
          deviceName: dev?.name,
        });
      }
    }
  }
  return out.sort((a, b) => b.riskScore - a.riskScore);
}

// ---------------- Metric generation (simulated telemetry) ----------------
export function generateMetric(base: { latency: number; loss: number; bw: number; cpu: number; mem: number; conn: number }) {
  const rnd = (v: number, spread = 0.25) => +(v * (1 + (Math.random() - 0.5) * 2 * spread)).toFixed(2);
  return {
    latency_ms: Math.max(0.05, rnd(base.latency)),
    packet_loss: Math.max(0, rnd(base.loss, 1)),
    bandwidth_mbps: Math.max(0, rnd(base.bw)),
    upload_mbps: Math.max(0, rnd(base.bw * 0.35)),
    download_mbps: Math.max(0, rnd(base.bw * 0.75)),
    cpu_usage: Math.min(100, Math.max(0, rnd(base.cpu))),
    memory_usage: Math.min(100, Math.max(0, rnd(base.mem))),
    connection_count: Math.max(0, Math.round(rnd(base.conn))),
  };
}
export function deviceBaseline(type: string) {
  const t: Record<string, { latency: number; loss: number; bw: number; cpu: number; mem: number; conn: number }> = {
    Router: { latency: 1.4, loss: 0.2, bw: 620, cpu: 38, mem: 55, conn: 900 },
    "Layer 3 Switch": { latency: 0.8, loss: 0.1, bw: 840, cpu: 30, mem: 48, conn: 1200 },
    "Layer 2 Switch": { latency: 0.3, loss: 0.05, bw: 950, cpu: 18, mem: 32, conn: 1500 },
    Server: { latency: 0.9, loss: 0.1, bw: 210, cpu: 52, mem: 68, conn: 650 },
    PC: { latency: 2.1, loss: 0.4, bw: 28, cpu: 22, mem: 40, conn: 40 },
    Laptop: { latency: 2.3, loss: 0.5, bw: 22, cpu: 20, mem: 38, conn: 30 },
    "Access Point": { latency: 3.2, loss: 0.8, bw: 120, cpu: 26, mem: 42, conn: 200 },
    Firewall: { latency: 1.1, loss: 0.1, bw: 700, cpu: 44, mem: 58, conn: 1100 },
  };
  return t[type] ?? t.PC;
}

// ---------------- Suspicious traffic heuristics ----------------
export type SuspiciousFinding = { device_id: number; deviceName?: string; kind: string; severity: "critical" | "high" | "medium"; detail: string; evidence: string };
export function detectSuspicious(devices: DeviceRow[], metrics: MetricRow[]): SuspiciousFinding[] {
  const out: SuspiciousFinding[] = [];
  const byDevice = new Map<number, MetricRow[]>();
  metrics.forEach((m) => { (byDevice.get(m.device_id) ?? byDevice.set(m.device_id, []).get(m.device_id)!).push(m); });
  for (const [devId, rows] of byDevice) {
    const sorted = rows.slice().sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
    const recent = sorted.slice(-6);
    const baseline = detectAnomalies(devices, sorted);
    const dev = devices.find((d) => d.id === devId);
    const bwAvg = stats(recent.map((r) => r.bandwidth_mbps ?? 0)).mean;
    const bwHist = stats(sorted.slice(0, -6).map((r) => r.bandwidth_mbps ?? 0)).mean;
    if (bwHist > 0 && bwAvg > bwHist * 1.8)
      out.push({ device_id: devId, deviceName: dev?.name, kind: "bandwidth_spike", severity: bwAvg > bwHist * 3 ? "high" : "medium",
        detail: `Recent bandwidth ${bwAvg.toFixed(0)} Mbps vs historical ${bwHist.toFixed(0)} Mbps (${(((bwAvg - bwHist) / bwHist) * 100).toFixed(0)}% above).`,
        evidence: "Statistical deviation over recent metric samples." });
    const lossAvg = stats(recent.map((r) => r.packet_loss ?? 0)).mean;
    if (lossAvg > 5)
      out.push({ device_id: devId, deviceName: dev?.name, kind: "excessive_packet_loss", severity: lossAvg > 15 ? "high" : "medium",
        detail: `Average packet loss ${lossAvg.toFixed(1)}% over recent samples (threshold 5%).`, evidence: "Packet loss samples from network_metrics." });
    const conn = recent.map((r) => r.connection_count ?? 0);
    const connHist = stats(sorted.slice(0, -6).map((r) => r.connection_count ?? 0)).mean;
    if (connHist > 0 && stats(conn).mean > connHist * 1.7)
      out.push({ device_id: devId, deviceName: dev?.name, kind: "repeated_connection_attempts", severity: "medium",
        detail: `Connection count ${stats(conn).mean.toFixed(0)} vs baseline ${connHist.toFixed(0)} — possible scanning or DoS attempt.`,
        evidence: "Elevated connection_count relative to device baseline." });
    if (dev && dev.status === "offline")
      out.push({ device_id: devId, deviceName: dev.name, kind: "device_offline", severity: "high",
        detail: `Device went offline while metrics show prior activity.`, evidence: "Device status flag in inventory." });
  }
  return out;
}
