import { NextResponse } from "next/server";
import { body, handler, HttpError, num, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

type Ctx = { params?: Record<string, string> };
async function owned(userId: number, ifId: number) {
  const rows = await query(`SELECT i.*, d.project_id FROM netguardian.interfaces i
    JOIN netguardian.devices d ON d.id = i.device_id JOIN netguardian.projects p ON p.id = d.project_id
    WHERE i.id = $1 AND p.user_id = $2`, [ifId, userId]);
  if (!rows[0]) throw new HttpError(404, "Interface not found");
  return rows[0];
}

export const PATCH = handler(async (req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  await owned(userId, id);
  const b = await body<{ interface_name?: string; ip_address?: string | null; subnet_mask?: string | null; vlan_number?: number | null; status?: string }>(req);
  const rows = await query(
    `UPDATE netguardian.interfaces SET interface_name = COALESCE($2, interface_name), ip_address = COALESCE($3, ip_address),
     subnet_mask = COALESCE($4, subnet_mask), vlan_number = COALESCE($5, vlan_number), status = COALESCE($6, status) WHERE id = $1 RETURNING *`,
    [id, b.interface_name ?? null, b.ip_address ?? null, b.subnet_mask ?? null, b.vlan_number ?? null, b.status ?? null]);
  return NextResponse.json(rows[0]);
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const userId = await requireUser();
  const id = num(ctx.params?.id, "id");
  await owned(userId, id);
  await query(`DELETE FROM netguardian.interfaces WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
});
