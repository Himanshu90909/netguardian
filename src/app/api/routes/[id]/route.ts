import { NextResponse } from "next/server";
import { handler, HttpError, num, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

type Ctx = { params?: Record<string, string> };

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  const rows = await query(`SELECT r.* FROM netguardian.routes r JOIN netguardian.projects p ON p.id = r.project_id
    WHERE r.id = $1 AND p.user_id = $2`, [id, userId]);
  if (!rows[0]) throw new HttpError(404, "Route not found");
  await query(`DELETE FROM netguardian.routes WHERE id = $1`, [id]);
  await query(`INSERT INTO netguardian.logs (project_id, event_type, message) VALUES ($1,'routing',$2)`,
    [rows[0].project_id, `Route removed: ${rows[0].destination} via ${rows[0].next_hop ?? "direct"}.`]);
  return NextResponse.json({ ok: true });
});
