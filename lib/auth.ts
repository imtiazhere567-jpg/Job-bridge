import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { COMPANY_COLS } from "./messages";
import type { Company, User } from "./types";

const COOKIE = "jobbridge_session";

export async function login(email: string, password: string): Promise<User | null> {
  const row = await db.one<User & { password_hash: string }>("select * from users where lower(email) = lower($1)", [email.trim()]);
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return null;
  await startSession(row.id);
  return row;
}

/** Portfolio demo: open the owner dashboard without a password. */
export async function loginDemo() {
  if (process.env.DEMO_MODE === "off") return null;
  const user = await db.one<User>("select id, name, email, phone, kind from users order by id limit 1");
  if (user) await startSession(user.id);
  return user;
}

async function startSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.q("insert into sessions (token, user_id, expires_at) values ($1, $2, now() + interval '14 days')", [token, userId]);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.q("delete from sessions where token = $1", [token]);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return db.one<User>(
    "select u.id, u.name, u.email, u.phone, u.kind from sessions s join users u on u.id = s.user_id where s.token = $1 and s.expires_at > now()",
    [token],
  );
}

/** The business this app runs for (one row, created on first start). */
export const getBusiness = async () => (await db.one<Company>(`select ${COMPANY_COLS} from companies order by id limit 1`))!;

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** The owner, plus the business. Every dashboard page and action uses this. */
export async function requireEmployer() {
  const user = await requireUser();
  return { user, company: await getBusiness() };
}
