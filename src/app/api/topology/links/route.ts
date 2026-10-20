import { NextResponse } from "next/server";
import { body, guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

export const POST = handler(async (req) => {
  const userId = await requireUser();
  const b = await body<{ project_id?: number; source_device?: number; destination_device?: number; source_interface?: string; destination_interface?: string; is_trunk?: boolean }>(req);
  if (!b.project_id || !b.source_device || !b.destination_device) throw new HttpError(400, "project_id, source_device and destination_device are required");
  if (b.source_device === b.destination_device) throw new HttpError(400, "Cannot connect a device to itself");
  await guardProject(userId, b.project_id);
  const dup = await query(`SELECT id FROM netguardian.topology_links WHERE project_id = $1 AND
    ((source_device = $2 AND destination_device = $3) OR (source_device = $3 AND destination_device = $2))`,
    [b.project_id, b.source_device, b.destination_device]);
  if (dup.length) throw new HttpError(409, "These devices are already connected");
  const rows = await query(
    `INSERT INTO netguardian.topology_links (project_id, source_device, destination_device, source_interface, destination_interface, status, is_trunk)
     VALUES ($1,$2,$3,$4,$5,'up',$6) RETURNING *`,
    [b.project_id, b.source_device, b.destination_device, b.source_interface ?? null, b.destination_interface ?? null, b.is_trunk ?? false]);
  const names = await query(`SELECT name FROM netguardian.devices WHERE id IN ($1,$2)`, [b.source_device, b.destination_device]);
  await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message) VALUES ($1,$2,'link',$3)`,
    [b.project_id, b.source_device, `Link established: ${names[0]?.name} ↔ ${names[1]?.name}${b.is_trunk ? " (802.1Q trunk)" : ""}.`]);
  return NextResponse.json(rows[0]);
});
