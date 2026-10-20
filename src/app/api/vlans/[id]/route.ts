import { NextResponse } from "next/server";
import { body, handler, HttpError, num, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

type Ctx = { params?: Record<string, string> };
async function owned(userId: number, vlanId: number) {
  const rows = await query(`SELECT v.* FROM netguardian.vlans v JOIN netguardian.projects p ON p.id = v.project_id
    WHERE v.id = $1 AND p.user_id = $2`, [vlanId, userId]);
  if (!rows[0]) throw new HttpError(404, "VLAN not found");
  return rows[0];
}

export const PATCH = handler(async (req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  const v = await owned(userId, id);
  const b = await body<{ name?: string; subnet?: string | null; gateway?: string | null }>(req);
  const rows = await query(`UPDATE netguardian.vlans SET name = COALESCE($2, name), subnet = COALESCE($3, subnet), gateway = COALESCE($4, gateway) WHERE id = $1 RETURNING *`,
    [id, b.name ?? null, b.subnet ?? null, b.gateway ?? null]);
  return NextResponse.json(rows[0]);
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  const v = await owned(userId, id);
  await query(`DELETE FROM netguardian.vlans WHERE id = $1`, [id]);
  await query(`INSERT INTO netguardian.logs (project_id, event_type, message) VALUES ($1,'vlan',$2)`,
    [v.project_id, `VLAN ${v.vlan_id} (${v.name}) deleted.`]);
  return NextResponse.json({ ok: true });
});
