import { NextResponse } from "next/server";
import { body, guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const projectId = Number(new URL(req.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const routes = await query(`SELECT * FROM netguardian.routes WHERE project_id = $1 ORDER BY destination`, [projectId]);
  return NextResponse.json({ routes });
});

export const POST = handler(async (req) => {
  const userId = await requireUser();
  const b = await body<{ project_id?: number; destination?: string; subnet_mask?: string; next_hop?: string; interface_name?: string; protocol?: string; metric?: number }>(req);
  if (!b.project_id || !b.destination?.trim()) throw new HttpError(400, "project_id and destination are required");
  if (b.protocol && !["static", "ospf", "rip", "connected"].includes(b.protocol)) throw new HttpError(400, "protocol must be static, ospf, rip or connected");
  await guardProject(userId, b.project_id);
  const rows = await query(
    `INSERT INTO netguardian.routes (project_id, destination, subnet_mask, next_hop, interface_name, protocol, metric)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [b.project_id, b.destination.trim(), b.subnet_mask ?? "255.255.255.0", b.next_hop ?? null, b.interface_name ?? null, b.protocol ?? "static", b.metric ?? 1]);
  await query(`INSERT INTO netguardian.logs (project_id, event_type, message) VALUES ($1,'routing',$2)`,
    [b.project_id, `Route added: ${b.destination}${b.subnet_mask ? " " + b.subnet_mask : ""} via ${b.next_hop ?? b.interface_name ?? "direct"} (${b.protocol ?? "static"}, metric ${b.metric ?? 1}).`]);
  return NextResponse.json(rows[0]);
});
