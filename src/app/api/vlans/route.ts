import { NextResponse } from "next/server";
import { body, guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const projectId = Number(new URL(req.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const vlans = await query(`SELECT * FROM netguardian.vlans WHERE project_id = $1 ORDER BY vlan_id`, [projectId]);
  return NextResponse.json({ vlans });
});

export const POST = handler(async (req) => {
  const userId = await requireUser();
  const b = await body<{ project_id?: number; vlan_id?: number; name?: string; subnet?: string; gateway?: string }>(req);
  if (!b.project_id || !b.vlan_id || !b.name?.trim()) throw new HttpError(400, "project_id, vlan_id and name are required");
  if (b.vlan_id < 1 || b.vlan_id > 4094) throw new HttpError(400, "VLAN ID must be 1-4094 (IEEE 802.1Q)");
  await guardProject(userId, b.project_id);
  const dup = await query(`SELECT id FROM netguardian.vlans WHERE project_id = $1 AND vlan_id = $2`, [b.project_id, b.vlan_id]);
  if (dup.length) throw new HttpError(409, `VLAN ${b.vlan_id} already exists in this project`);
  const rows = await query(`INSERT INTO netguardian.vlans (project_id, vlan_id, name, subnet, gateway) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [b.project_id, b.vlan_id, b.name.trim(), b.subnet ?? null, b.gateway ?? null]);
  await query(`INSERT INTO netguardian.logs (project_id, event_type, message) VALUES ($1,'vlan',$2)`,
    [b.project_id, `VLAN ${b.vlan_id} (${b.name.trim()}) created — subnet ${b.subnet ?? "n/a"}, gateway ${b.gateway ?? "n/a"}.`]);
  return NextResponse.json(rows[0]);
});
