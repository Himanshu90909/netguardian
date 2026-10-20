import { guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const projectId = Number(new URL(req.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const devices = await query(`SELECT * FROM netguardian.devices WHERE project_id = $1 ORDER BY name`, [projectId]);
  const vlans = await query(`SELECT * FROM netguardian.vlans WHERE project_id = $1 ORDER BY vlan_id`, [projectId]);
  const routes = await query(`SELECT * FROM netguardian.routes WHERE project_id = $1`, [projectId]);
  const alerts = await query(`SELECT * FROM netguardian.alerts WHERE project_id = $1`, [projectId]);
  const lines: string[] = [];
  lines.push("SECTION,RECORD");
  lines.push(`PROJECT,${csvEscape((await query(`SELECT name FROM netguardian.projects WHERE id = $1`, [projectId]))[0]?.name ?? "")}`);
  lines.push(",,");
  lines.push("DEVICES,Name,Type,IP,MAC,Status,Location");
  for (const d of devices) lines.push(["DEVICE", d.name, d.device_type, d.ip_address, d.mac_address, d.status, d.location].map(csvEscape).join(","));
  lines.push(",,");
  lines.push("VLANS,Name,Subnet,Gateway");
  for (const v of vlans) lines.push(["VLAN", v.name, v.subnet, v.gateway].map(csvEscape).join(","));
  lines.push(",,");
  lines.push("ROUTES,Destination,NextHop,Interface,Protocol,Metric");
  for (const r of routes) lines.push(["ROUTE", r.destination + "/" + r.subnet_mask, r.next_hop, r.interface_name, r.protocol, r.metric].map(csvEscape).join(","));
  lines.push(",,");
  lines.push("ALERTS,Severity,Type,Status,Message");
  for (const a of alerts) lines.push(["ALERT", a.severity, a.alert_type, a.status, a.message].map(csvEscape).join(","));
  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="netguardian-report-${projectId}.csv"` },
  });
});
