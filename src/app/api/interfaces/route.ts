import { NextResponse } from "next/server";
import { body, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const deviceId = Number(new URL(req.url).searchParams.get("deviceId"));
  if (!Number.isFinite(deviceId)) throw new HttpError(400, "deviceId is required");
  const dev = await query(`SELECT d.id, d.project_id FROM netguardian.devices d JOIN netguardian.projects p ON p.id = d.project_id WHERE d.id = $1 AND p.user_id = $2`, [deviceId, userId]);
  if (!dev[0]) throw new HttpError(404, "Device not found");
  const interfaces = await query(`SELECT * FROM netguardian.interfaces WHERE device_id = $1 ORDER BY id`, [deviceId]);
  return NextResponse.json({ interfaces });
});

export const POST = handler(async (req) => {
  const userId = await requireUser();
  const b = await body<{ device_id?: number; interface_name?: string; ip_address?: string; subnet_mask?: string; mac_address?: string; vlan_number?: number; status?: string }>(req);
  if (!b.device_id || !b.interface_name?.trim()) throw new HttpError(400, "device_id and interface_name are required");
  const dev = await query(`SELECT d.id, d.name, d.project_id FROM netguardian.devices d JOIN netguardian.projects p ON p.id = d.project_id WHERE d.id = $1 AND p.user_id = $2`, [b.device_id, userId]);
  if (!dev[0]) throw new HttpError(404, "Device not found");
  const rows = await query(
    `INSERT INTO netguardian.interfaces (device_id, interface_name, ip_address, subnet_mask, mac_address, vlan_number, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [b.device_id, b.interface_name.trim(), b.ip_address ?? null, b.subnet_mask ?? null, b.mac_address ?? null, b.vlan_number ?? null, b.status ?? "up"]);
  await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message) VALUES ($1,$2,'interface',$3)`,
    [dev[0].project_id, b.device_id, `Interface ${b.interface_name} configured on ${dev[0].name}.`]);
  return NextResponse.json(rows[0]);
});
