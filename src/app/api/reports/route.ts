import { NextResponse } from "next/server";
import { guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { detectAnomalies, MetricRow } from "@/lib/network";

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const projectId = Number(new URL(req.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const project = (await query(`SELECT * FROM netguardian.projects WHERE id = $1`, [projectId]))[0];
  const devices = await query(`SELECT * FROM netguardian.devices WHERE project_id = $1 ORDER BY name`, [projectId]);
  const vlans = await query(`SELECT * FROM netguardian.vlans WHERE project_id = $1 ORDER BY vlan_id`, [projectId]);
  const routes = await query(`SELECT * FROM netguardian.routes WHERE project_id = $1`, [projectId]);
  const links = await query(`SELECT * FROM netguardian.topology_links WHERE project_id = $1`, [projectId]);
  const alerts = await query(`SELECT a.*, d.name as device_name FROM netguardian.alerts a LEFT JOIN netguardian.devices d ON d.id = a.device_id WHERE a.project_id = $1 ORDER BY a.created_at DESC`, [projectId]);
  const logs = await query(`SELECT * FROM netguardian.logs WHERE project_id = $1 ORDER BY timestamp DESC LIMIT 100`, [projectId]);
  const metrics = await query<MetricRow>(`SELECT device_id, latency_ms, packet_loss, bandwidth_mbps, cpu_usage, memory_usage, connection_count, timestamp
    FROM netguardian.network_metrics WHERE device_id IN (SELECT id FROM netguardian.devices WHERE project_id = $1) ORDER BY timestamp`, [projectId]);
  const anomalies = detectAnomalies(devices as any, metrics);
  const online = devices.filter((d: any) => d.status === "online").length;
  const avgLatency = metrics.length ? +(metrics.reduce((a: number, m: MetricRow) => a + (m.latency_ms ?? 0), 0) / metrics.length).toFixed(2) : 0;
  const avgLoss = metrics.length ? +(metrics.reduce((a: number, m: MetricRow) => a + (m.packet_loss ?? 0), 0) / metrics.length).toFixed(2) : 0;
  const uptimePct = devices.length ? +((online / devices.length) * 100).toFixed(1) : 100;
  const recommendations: string[] = [];
  if (avgLoss > 2) recommendations.push("Average packet loss exceeds 2% — inspect cabling and error counters on access ports.");
  if (anomalies.length) recommendations.push("Anomaly detection flagged devices deviating from baseline — review the Anomaly page and capacity-plan the affected segments.");
  if (alerts.some((a: any) => a.severity === "critical" && a.status === "active")) recommendations.push("Active critical alerts present — prioritize restoration of the affected core devices.");
  if (!vlans.length) recommendations.push("No VLANs configured — segment the network for broadcast-domain isolation and security.");
  if (!recommendations.length) recommendations.push("Network is operating within expected parameters — continue regular monitoring.");
  return NextResponse.json({
    report: {
      project, generatedAt: new Date().toISOString(),
      inventory: { total: devices.length, online, offline: devices.length - online },
      vlans, routes, links, alerts, logs,
      performance: { avgLatencyMs: avgLatency, avgPacketLoss: avgLoss, uptimePct },
      anomalies, recommendations,
      dataNote: "Network metrics are SIMULATED telemetry (clearly labeled); inventory/configuration/alert data is real stored data.",
    },
  });
});
