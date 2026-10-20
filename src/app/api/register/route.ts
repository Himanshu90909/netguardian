import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { body, handler, HttpError } from "@/lib/api";
import { ensureSchema, query } from "@/lib/db";

export const POST = handler(async (req) => {
  const { name, email, password } = await body<{ name?: string; email?: string; password?: string }>(req);
  if (!name || !email || !password) throw new HttpError(400, "Name, email and password are required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Invalid email address");
  if (password.length < 6) throw new HttpError(400, "Password must be at least 6 characters");
  await ensureSchema();
  const lower = email.toLowerCase().trim();
  const existing = await query(`SELECT id FROM netguardian.users WHERE email = $1`, [lower]);
  if (existing.length) throw new HttpError(409, "An account with this email already exists");
  const hash = await bcrypt.hash(password, 10);
  const rows = await query<{ id: number }>(
    `INSERT INTO netguardian.users (email, name, password_hash, provider) VALUES ($1,$2,$3,'credentials') RETURNING id`,
    [lower, name, hash]);
  return NextResponse.json({ ok: true, id: rows[0].id });
});
