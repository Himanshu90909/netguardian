import { NextResponse } from "next/server";
import { body, guardProject, handler, HttpError, num, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

type Ctx = { params?: Record<string, string> };

export const GET = handler(async (_req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  await guardProject(userId, id);
  const project = (await query(`SELECT * FROM netguardian.projects WHERE id = $1`, [id]))[0];
  const devices = await query(`SELECT * FROM netguardian.devices WHERE project_id = $1 ORDER BY name`, [id]);
  const vlans = await query(`SELECT * FROM netguardian.vlans WHERE project_id = $1 ORDER BY vlan_id`, [id]);
  const routes = await query(`SELECT * FROM netguardian.routes WHERE project_id = $1 ORDER BY destination`, [id]);
  const links = await query(`SELECT * FROM netguardian.topology_links WHERE project_id = $1`, [id]);
  return NextResponse.json({ project, devices, vlans, routes, links });
});

export const PATCH = handler(async (req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  await guardProject(userId, id);
  const { name, description, network_type } = await body<{ name?: string; description?: string; network_type?: string }>(req);
  const rows = await query(
    `UPDATE netguardian.projects SET name = COALESCE($2, name), description = COALESCE($3, description),
     network_type = COALESCE($4, network_type), updated_at = now() WHERE id = $1 RETURNING *`, [id, name ?? null, description ?? null, network_type ?? null]);
  if (!rows[0]) throw new HttpError(404, "Project not found");
  return NextResponse.json(rows[0]);
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  await guardProject(userId, id);
  await query(`DELETE FROM netguardian.projects WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
});
