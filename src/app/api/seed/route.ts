import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/api";
import { seedSampleProject } from "@/lib/seed";

export const POST = handler(async (req) => {
  const userId = await requireUser();
  const projectId = await seedSampleProject(userId);
  return NextResponse.json({ ok: true, projectId, note: "Sample project uses SIMULATED metrics (clearly labeled in UI)." });
});
