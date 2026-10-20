import { NextResponse } from "next/server";
import { body, guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const projectId = Number(new URL(req.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const acl = await query(`SELECT * FROM netguardian.acl_rules WHERE project_id = $1 ORDER BY rule_number`, [projectId]);
  const portSec = await query(
    `SELECT ps.*, d.name as device_name FROM netguardian.port_security ps
     LEFT JOIN netguardian.devices d ON d.id = ps.device_id WHERE ps.project_id = $1`, [projectId]);
  return NextResponse.json({ acl, portSecurity: portSec });
});

export const POST = handler(async (req) => {
  const userId = await requireUser();
  const b = await body<{ project_id?: number; kind?: string; rule_number?: number; source_ip?: string; destination_ip?: string; protocol?: string; port?: string; action?: string; note?: string; device_id?: number; switch_port?: string; mac_address?: string; max_mac?: number }>(req);
  if (!b.project_id || !b.kind) throw new HttpError(400, "project_id and kind are required");
  await guardProject(userId, b.project_id);
  if (b.kind === "acl") {
    if (!b.rule_number || !b.source_ip || !b.destination_ip || !b.action) throw new HttpError(400, "rule_number, source_ip, destination_ip and action are required");
    if (!["ALLOW", "DENY"].includes(b.action)) throw new HttpError(400, "action must be ALLOW or DENY");
    const rows = await query(
      `INSERT INTO netguardian.acl_rules (project_id, rule_number, source_ip, destination_ip, protocol, port, action, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.project_id, b.rule_number, b.source_ip, b.destination_ip, b.protocol ?? "TCP", b.port ?? "any", b.action, b.note ?? null]);
    await query(`INSERT INTO netguardian.logs (project_id, event_type, message) VALUES ($1,'acl',$2)`,
      [b.project_id, `ACL rule #${b.rule_number} added: ${b.action} ${b.protocol ?? "TCP"}/${b.port ?? "any"} ${b.source_ip} -> ${b.destination_ip}.`]);
    return NextResponse.json(rows[0]);
  }
  if (b.kind === "port_security") {
    if (!b.device_id || !b.switch_port || !b.mac_address) throw new HttpError(400, "device_id, switch_port and mac_address are required");
    const rows = await query(
      `INSERT INTO netguardian.port_security (project_id, device_id, switch_port, mac_address, max_mac)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`, [b.project_id, b.device_id, b.switch_port, b.mac_address, b.max_mac ?? 1]);
    await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message) VALUES ($1,$2,'security',$3)`,
      [b.project_id, b.device_id, `Port security enabled on ${b.switch_port} — sticky MAC ${b.mac_address} (max ${b.max_mac ?? 1}).`]);
    return NextResponse.json(rows[0]);
  }
  throw new HttpError(400, "kind must be acl or port_security");
});
