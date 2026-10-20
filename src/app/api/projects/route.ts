import { NextResponse } from "next/server";
import { body, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = handler(async () => {
  const userId = await requireUser();
  const projects = await query(`SELECT * FROM netguardian.projects WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
  return NextResponse.json({ projects });
});

export const POST = handler(async (req) => {
  const userId = await requireUser();
  const { name, description, network_type } = await body<{ name?: string; description?: string; network_type?: string }>(req);
  if (!name?.trim()) throw new HttpError(400, "Project name is required");
  const rows = await query<{ id: number }>(
    `INSERT INTO netguardian.projects (user_id, name, description, network_type) VALUES ($1,$2,$3,$4) RETURNING id`,
    [userId, name.trim(), description ?? null, network_type ?? "Enterprise LAN"]);
  return NextResponse.json({ id: rows[0].id });
});
