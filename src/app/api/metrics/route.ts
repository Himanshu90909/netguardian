import { NextResponse } from "next/server";
import { body, guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { deviceBaseline, generateMetric } from "@/lib/network";

// GET /api/metrics?projectId=1&window=24 — aggregated time series for charts
export const GET = handler(async (req) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const projectId = Number(url.searchParams.get("projectId"));
  const window = Number(url.searchParams.get("window") ?? 24);
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const devices = await query(`SELECT id, name, device_type, status FROM netguardian.devices WHERE project_id = $1`, [projectId]);
  if (!devices.length) return NextResponse.json({ series: [], summary: null, devices: [] });
  const ids = devices.map((d: any) => d.id);
  const rows = await query(
    `SELECT m.*, to_char(m.timestamp, 'HH24:MI') as t
     FROM netguardian.network_metrics m
     WHERE m.device_id IN (SELECT id FROM netguardian.devices WHERE project_id = $1)
       AND m.timestamp > now() - ($2 || ' hours')::interval
     ORDER BY m.timestamp`, [projectId, window]);
  // Per-hour aggregation across devices
  const byTime = new Map<string, any>();
  for (const r of rows) {
    const ts = typeof r.timestamp === "string" ? r.timestamp : new Date(r.timestamp).toISOString();
    const key = ts.slice(0, 13);
    if (!byTime.has(key)) byTime.set(key, { t: r.t, ts, n: 0, latency: 0, loss: 0, bw: 0, cpu: 0, mem: 0, up: 0, down: 0, upl: 0, dnl: 0 });
    const a = byTime.get(key);
    a.n++; a.latency += r.latency_ms ?? 0; a.loss += r.packet_loss ?? 0; a.bw += r.bandwidth_mbps ?? 0;
    a.cpu += r.cpu_usage ?? 0; a.mem += r.memory_usage ?? 0; a.upl += r.upload_mbps ?? 0; a.dnl += r.download_mbps ?? 0;
  }
  const series = Array.from(byTime.values()).map((a) => ({
    t: a.t, latency: +(a.latency / a.n).toFixed(2), packetLoss: +(a.loss / a.n).toFixed(2),
    bandwidth: +a.bw.toFixed(1), upload: +a.upl.toFixed(1), download: +a.dnl.toFixed(1),
    cpu: +(a.cpu / a.n).toFixed(1), memory: +(a.mem / a.n).toFixed(1),
  }));
  const summary = {
    totalDevices: devices.length,
    online: devices.filter((d: any) => d.status === "online").length,
    offline: devices.filter((d: any) => d.status === "offline").length,
    avgLatency: rows.length ? +(rows.reduce((a: number, r: any) => a + (r.latency_ms ?? 0), 0) / rows.length).toFixed(2) : 0,
    avgLoss: rows.length ? +(rows.reduce((a: number, r: any) => a + (r.packet_loss ?? 0), 0) / rows.length).toFixed(2) : 0,
    totalBandwidth: +(rows.slice(-Math.max(1, devices.length)).reduce((a: number, r: any) => a + (r.bandwidth_mbps ?? 0), 0)).toFixed(1),
  };
  return NextResponse.json({ series, summary, devices, simulated: true });
});

// POST /api/metrics — simulate one telemetry collection cycle (appends fresh samples)
export const POST = handler(async (req) => {
  const userId = await requireUser();
  const { project_id, scenario } = await body<{ project_id?: number; scenario?: string }>(req);
  if (!project_id) throw new HttpError(400, "project_id is required");
  await guardProject(userId, project_id);
  const devices = await query(`SELECT * FROM netguardian.devices WHERE project_id = $1`, [project_id]);
  for (const d of devices) {
    if (d.status === "offline") continue;
    const base = deviceBaseline(d.device_type);
    const m = generateMetric(base);
    if (scenario === "bandwidth_spike" && Math.random() < 0.4) { m.bandwidth_mbps = +(m.bandwidth_mbps * 6).toFixed(1); m.upload_mbps = +(m.upload_mbps * 6).toFixed(1); }
    if (scenario === "high_latency" && Math.random() < 0.5) { m.latency_ms = +(m.latency_ms * 8).toFixed(2); }
    if (scenario === "packet_loss" && Math.random() < 0.5) { m.packet_loss = +(8 + Math.random() * 10).toFixed(2); }
    await query(
      `INSERT INTO netguardian.network_metrics (device_id, latency_ms, packet_loss, bandwidth_mbps, upload_mbps, download_mbps, cpu_usage, memory_usage, connection_count, is_simulated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
      [d.id, m.latency_ms, m.packet_loss, m.bandwidth_mbps, m.upload_mbps, m.download_mbps, m.cpu_usage, m.memory_usage, m.connection_count]);
  }
  await query(`UPDATE netguardian.devices SET uptime_s = uptime_s + 60 WHERE project_id = $1`, [project_id]);
  return NextResponse.json({ ok: true, collected: devices.length, simulated: true });
});
