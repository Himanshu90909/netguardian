import { NextResponse } from "next/server";
import { guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const projectId = Number(url.searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const search = url.searchParams.get("search");
  const eventType = url.searchParams.get("type");
  const deviceId = Number(url.searchParams.get("deviceId"));
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  let q = `SELECT l.*, d.name as device_name FROM netguardian.logs l
    LEFT JOIN netguardian.devices d ON d.id = l.device_id WHERE l.project_id = $1`;
  const params: any[] = [projectId];
  if (search) { params.push(`%${search}%`); q += ` AND l.message ILIKE $${params.length}`; }
  if (eventType) { params.push(eventType); q += ` AND l.event_type = $${params.length}`; }
  if (Number.isFinite(deviceId) && deviceId > 0) { params.push(deviceId); q += ` AND l.device_id = $${params.length}`; }
  if (from) { params.push(from); q += ` AND l.timestamp >= $${params.length}`; }
  if (to) { params.push(to); q += ` AND l.timestamp <= $${params.length}::timestamptz + interval '1 day'`; }
  q += ` ORDER BY l.timestamp DESC LIMIT 500`;
  const logs = await query(q, params);
  return NextResponse.json({ logs });
});
