import { NextResponse } from "next/server";
import { guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { detectSuspicious, MetricRow } from "@/lib/network";

// Suspicious-traffic analysis over stored (simulated) metrics — heuristic, NOT an enterprise IDS.
export const POST = handler(async (req) => {
  const userId = await requireUser();
  const projectId = Number(new URL(req.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const devices = await query(`SELECT * FROM netguardian.devices WHERE project_id = $1`, [projectId]);
  const metrics = await query<MetricRow>(
    `SELECT device_id, latency_ms, packet_loss, bandwidth_mbps, cpu_usage, memory_usage, connection_count, timestamp
     FROM netguardian.network_metrics WHERE device_id IN (SELECT id FROM netguardian.devices WHERE project_id = $1)
     ORDER BY timestamp DESC LIMIT 600`, [projectId]);
  const findings = detectSuspicious(devices, metrics);
  // Promote high-severity findings to alerts
  for (const f of findings.filter((x: any) => x.severity === "high" || x.severity === "critical")) {
    const existing = await query(`SELECT id FROM netguardian.alerts WHERE project_id = $1 AND alert_type = $2 AND device_id = $3 AND status = 'active'`,
      [projectId, f.kind, f.device_id]);
    if (!existing.length)
      await query(`INSERT INTO netguardian.alerts (project_id, device_id, alert_type, severity, message) VALUES ($1,$2,$3,'high',$4)`,
        [projectId, f.device_id, f.kind, `Suspicious traffic: ${f.detail}`]);
  }
  if (findings.length)
    await query(`INSERT INTO netguardian.logs (project_id, event_type, message) VALUES ($1,'security',$2)`,
      [projectId, `Security scan completed — ${findings.length} suspicious finding(s) from simulated metrics.`]);
  return NextResponse.json({ findings, note: "Heuristic analysis of stored (simulated) metrics. This is not a real IDS — no live packet capture is performed.", simulated: true });
});
