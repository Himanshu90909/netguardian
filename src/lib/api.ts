// Shared API helpers: auth guard, validation, error handling.
import { getServerSession } from "next-auth";
import { query } from "./db";
import { authOptions } from "./auth";
import { ensureSchema } from "./db";
import { NextResponse } from "next/server";

export async function requireUser(): Promise<number> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new HttpError(401, "Authentication required");
  await ensureSchema();
  const rows = await query(`SELECT id FROM netguardian.users WHERE email = $1`, [session.user.email.toLowerCase()]);
  if (!rows[0]) throw new HttpError(401, "User not found");
  return rows[0].id;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function guardProject(userId: number, projectId: number) {
  const rows = await query(`SELECT id FROM netguardian.projects WHERE id = $1 AND user_id = $2`, [projectId, userId]);
  if (!rows[0]) throw new HttpError(404, "Project not found");
}

export function handler(fn: (req: Request, ctx: { params?: Record<string, string> }) => Promise<Response>) {
  return async (req: Request, ctx: { params?: Record<string, string> }) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error("[API]", e);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request): Promise<T> {
  try { return await req.json() as T; } catch { throw new HttpError(400, "Invalid JSON body"); }
}

export function num(v: string | undefined, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new HttpError(400, `Invalid ${name}`);
  return n;
}

export const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
export const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
export function validIp(ip: string) { return IP_RE.test(ip) && ip.split(".").every((o) => Number(o) <= 255); }
