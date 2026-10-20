import { NextResponse } from "next/server";
import { body, guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const projectId = Number(new URL(req.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const devices = await query(`SELECT * FROM netguardian.devices WHERE project_id = $1 ORDER BY name`, [projectId]);
  return NextResponse.json({ devices });
});

export const POST = handler(async (req) => {
  const userId = await requireUser();
  const d = await body<{ project_id?: number; name?: string; device_type?: string; ip_address?: string; mac_address?: string; status?: string; location?: string; x?: number; y?: number }>(req);
  if (!d.project_id || !d.name?.trim() || !d.device_type) throw new HttpError(400, "project_id, name and device_type are required");
  const TYPES = ["Router", "Layer 3 Switch", "Layer 2 Switch", "Server", "PC", "Laptop", "Access Point", "Firewall"];
  if (!TYPES.includes(d.device_type)) throw new HttpError(400, `device_type must be one of: ${TYPES.join(", ")}`);
  await guardProject(userId, d.project_id);
  const rows = await query(
    `INSERT INTO netguardian.devices (project_id, name, device_type, ip_address, mac_address, status, location, x, y)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [d.project_id, d.name.trim(), d.device_type, d.ip_address ?? null, d.mac_address ?? null, d.status ?? "online", d.location ?? null, d.x ?? Math.random() * 400 + 60, d.y ?? Math.random() * 300 + 40]);
  await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message) VALUES ($1,$2,'device_add',$3)`,
    [d.project_id, rows[0].id, `Device ${d.name.trim()} (${d.device_type}) added to inventory.`]);
  return NextResponse.json(rows[0]);
});
