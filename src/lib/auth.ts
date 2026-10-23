// NextAuth setup — Credentials (email/password, bcrypt) + optional Google OAuth.
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { query, ensureSchema } from "./db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET || "netguardian-dev-secret-change-me",
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        await ensureSchema();
        const ident = credentials.email.toLowerCase().trim();
        let rows = await query(
          `SELECT * FROM netguardian.users WHERE email = $1`, [ident]
        );
        if (!rows.length) {
          // Tolerate browser-autofill pollution: Chrome sometimes prepends the saved
          // display name to the email ("Himanshu Suthar" + "user@x.com"). If the identifier
          // ENDS with a registered email, accept that account.
          rows = await query(
            `SELECT * FROM netguardian.users WHERE $1 LIKE '%' || email ORDER BY length(email) DESC LIMIT 1`, [ident]
          );
        }
        const user = rows[0];
        if (!user) return null;
        if (!user.password_hash) return null; // OAuth-only account
        const ok = await bcrypt.compare(credentials.password, user.password_hash);
        if (!ok) return null;
        return { id: String(user.id), name: user.name, email: user.email, image: user.profile_image };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [require("next-auth/providers/google").default({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user?.email) {
        await ensureSchema();
        const email = user.email.toLowerCase();
        const existing = await query(`SELECT id FROM netguardian.users WHERE email = $1`, [email]);
        if (existing.length === 0) {
          const bcryptRounds = 10;
          await query(
            `INSERT INTO netguardian.users (email, name, profile_image, password_hash, provider) VALUES ($1,$2,$3,$4,$5)`,
            [email, user.name || email.split("@")[0], (user as { image?: string }).image ?? null,
             account?.provider === "credentials" ? (user as { passwordHash?: string }).passwordHash ?? null : null,
             account?.provider ?? "credentials"]
          );
        } else if (account?.provider === "google") {
          await query(`UPDATE netguardian.users SET name = COALESCE($2, name), profile_image = COALESCE($3, profile_image) WHERE email = $1`,
            [email, user.name ?? null, (user as { image?: string }).image ?? null]);
        }
        const dbUser = await query<{ id: number }>(`SELECT id FROM netguardian.users WHERE email = $1`, [email]);
        token.uid = dbUser[0]?.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) (session.user as { uid?: number }).uid = token.uid as number;
      return session;
    },
  },
};
