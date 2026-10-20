import { NextResponse } from "next/server";
import { body, handler, HttpError, num, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

type Ctx = { params?: Record<string, string> };

async function owned(userId: number, deviceId: number) {
  const rows = await query(`SELECT d.* FROM netguardian.devices d JOIN netguardian.projects p ON p.id = d.project_id
    WHERE d.id = $1 AND p.user_id = $2`, [deviceId, userId]);
  if (!rows[0]) throw new HttpError(404, "Device not found");
  return rows[0];
}

export const GET = handler(async (_req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  const device = await owned(userId, id);
  const interfaces = await query(`SELECT * FROM netguardian.interfaces WHERE device_id = $1`, [id]);
  const metrics = await query(`SELECT * FROM netguardian.network_metrics WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 48`, [id]);
  const links = await query(`SELECT * FROM netguardian.topology_links WHERE source_device = $1 OR destination_device = $1`, [id]);
  const logs = await query(`SELECT * FROM netguardian.logs WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 25`, [id]);
  const alerts = await query(`SELECT * FROM netguardian.alerts WHERE device_id = $1 ORDER BY created_at DESC LIMIT 25`, [id]);
  return NextResponse.json({ device, interfaces, metrics, links, logs, alerts });
});

export const PATCH = handler(async (req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  await owned(userId, id);
  const d = await body<{ name?: string; ip_address?: string | null; mac_address?: string | null; status?: string; location?: string | null; x?: number; y?: number; uptime_s?: number }>(req);
  const rows = await query(
    `UPDATE netguardian.devices SET name = COALESCE($2, name), ip_address = COALESCE($3, ip_address),
     mac_address = COALESCE($4, mac_address), status = COALESCE($5, status), location = COALESCE($6, location),
     x = COALESCE($7, x), y = COALESCE($8, y), uptime_s = COALESCE($9, uptime_s) WHERE id = $1 RETURNING *`,
    [id, d.name ?? null, d.ip_address ?? null, d.mac_address ?? null, d.status ?? null, d.location ?? null, d.x ?? null, d.y ?? null, d.uptime_s ?? null]);
  return NextResponse.json(rows[0]);
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  const device = await owned(userId, id);
  await query(`DELETE FROM netguardian.devices WHERE id = $1`, [id]);
  await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message) VALUES ($1,$2,'device_remove',$3)`,
    [device.project_id, id, `Device ${device.name} removed from inventory.`]);
  return NextResponse.json({ ok: true });
});
