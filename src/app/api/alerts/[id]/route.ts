import { NextResponse } from "next/server";
import { body, handler, HttpError, num, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

type Ctx = { params?: Record<string, string> };

export const PATCH = handler(async (req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  const rows = await query(`SELECT a.* FROM netguardian.alerts a JOIN netguardian.projects p ON p.id = a.project_id
    WHERE a.id = $1 AND p.user_id = $2`, [id, userId]);
  if (!rows[0]) throw new HttpError(404, "Alert not found");
  const { status } = await body<{ status?: string }>(req);
  if (!status || !["active", "acknowledged", "resolved"].includes(status)) throw new HttpError(400, "status must be active, acknowledged or resolved");
  const stampCol = status === "resolved" ? "resolved_at" : status === "acknowledged" ? "acknowledged_at" : null;
  const setStamp = stampCol ? `, ${stampCol} = now()` : "";
  const rows2 = await query(
    `UPDATE netguardian.alerts SET status = $2${setStamp} WHERE id = $1 RETURNING *`, [id, status]);
  await query(`INSERT INTO netguardian.logs (project_id, device_id, event_type, message) VALUES ($1,$2,'alert',$3)`,
    [rows[0].project_id, rows[0].device_id, `Alert #${id} marked ${status}.`]);
  return NextResponse.json(rows2[0]);
});
