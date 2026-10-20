import { NextResponse } from "next/server";
import { body, handler, HttpError, num, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

type Ctx = { params?: Record<string, string> };
async function owned(userId: number, linkId: number) {
  const rows = await query(`SELECT l.* FROM netguardian.topology_links l JOIN netguardian.projects p ON p.id = l.project_id
    WHERE l.id = $1 AND p.user_id = $2`, [linkId, userId]);
  if (!rows[0]) throw new HttpError(404, "Link not found");
  return rows[0];
}

export const PATCH = handler(async (req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  const link = await owned(userId, id);
  const b = await body<{ status?: string }>(req);
  if (b.status && !["up", "down", "warning"].includes(b.status)) throw new HttpError(400, "status must be up, down or warning");
  const rows = await query(`UPDATE netguardian.topology_links SET status = COALESCE($2, status) WHERE id = $1 RETURNING *`, [id, b.status ?? null]);
  if (b.status) {
    const names = await query(`SELECT name FROM netguardian.devices WHERE id IN ($1,$2)`, [link.source_device, link.destination_device]);
    await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message) VALUES ($1,$2,'link',$3)`,
      [link.project_id, link.source_device, `Link ${names[0]?.name} ↔ ${names[1]?.name} status changed to ${b.status}.`]);
  }
  return NextResponse.json(rows[0]);
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  const link = await owned(userId, id);
  await query(`DELETE FROM netguardian.topology_links WHERE id = $1`, [id]);
  const names = await query(`SELECT name FROM netguardian.devices WHERE id IN ($1,$2)`, [link.source_device, link.destination_device]);
  await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message) VALUES ($1,$2,'link',$3)`,
    [link.project_id, link.source_device, `Link removed: ${names[0]?.name} ↔ ${names[1]?.name}.`]);
  return NextResponse.json({ ok: true });
});
