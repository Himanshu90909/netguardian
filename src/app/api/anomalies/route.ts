import { NextResponse } from "next/server";
import { guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { detectAnomalies, MetricRow } from "@/lib/network";

export const POST = handler(async (req) => {
  const userId = await requireUser();
  const projectId = Number(new URL(req.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const devices = await query(`SELECT * FROM netguardian.devices WHERE project_id = $1`, [projectId]);
  const metrics = await query<MetricRow>(
    `SELECT device_id, latency_ms, packet_loss, bandwidth_mbps, cpu_usage, memory_usage, connection_count, timestamp
     FROM netguardian.network_metrics WHERE device_id IN (SELECT id FROM netguardian.devices WHERE project_id = $1)
     ORDER BY timestamp DESC LIMIT 1200`, [projectId]);
  const anomalies = detectAnomalies(devices, metrics);
  await query(`DELETE FROM netguardian.anomaly_results WHERE project_id = $1`, [projectId]);
  for (const a of anomalies)
    await query(`INSERT INTO netguardian.anomaly_results (project_id, device_id, metric, expected_value, observed_value, deviation, risk_score, reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [projectId, a.device_id, a.metric, a.expected, a.observed, a.deviationPct, a.riskScore, a.reason]);
  return NextResponse.json({ anomalies, method: "z-score vs per-device rolling baseline (explainable statistical detection)", simulated: true });
});

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const projectId = Number(new URL(req.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const results = await query(
    `SELECT ar.*, d.name as device_name FROM netguardian.anomaly_results ar
     LEFT JOIN netguardian.devices d ON d.id = ar.device_id WHERE ar.project_id = $1 ORDER BY ar.risk_score DESC`, [projectId]);
  return NextResponse.json({ anomalies: results });
});
