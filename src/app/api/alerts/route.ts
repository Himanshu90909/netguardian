import { NextResponse } from "next/server";
import { body, guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const url = new URL(req.url);
  const projectId = Number(url.searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const severity = url.searchParams.get("severity");
  const status = url.searchParams.get("status");
  let q = `SELECT a.*, d.name as device_name FROM netguardian.alerts a
    LEFT JOIN netguardian.devices d ON d.id = a.device_id WHERE a.project_id = $1`;
  const params: any[] = [projectId];
  if (severity) { params.push(severity); q += ` AND a.severity = $${params.length}`; }
  if (status) { params.push(status); q += ` AND a.status = $${params.length}`; }
  q += ` ORDER BY a.created_at DESC LIMIT 200`;
  const alerts = await query(q, params);
  return NextResponse.json({ alerts });
});
