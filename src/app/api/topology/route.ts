import { NextResponse } from "next/server";
import { guardProject, handler, HttpError, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

export const GET = handler(async (req) => {
  const userId = await requireUser();
  const projectId = Number(new URL(req.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) throw new HttpError(400, "projectId is required");
  await guardProject(userId, projectId);
  const devices = await query(`SELECT * FROM netguardian.devices WHERE project_id = $1 ORDER BY name`, [projectId]);
  const links = await query(`SELECT * FROM netguardian.topology_links WHERE project_id = $1`, [projectId]);
  return NextResponse.json({ devices, links });
});
