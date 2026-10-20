import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { ensureSchema } from "@/lib/db";

export const GET = handler(async () => {
  await ensureSchema();
  return NextResponse.json({ status: "ok", db: "connected", time: new Date().toISOString() });
});
