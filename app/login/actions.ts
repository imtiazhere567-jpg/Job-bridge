"use server";

import { redirect } from "next/navigation";
import { login, loginDemo } from "@/lib/auth";

export async function signIn(_: unknown, form: FormData) {
  const user = await login(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!user) return { error: "That email and password don't match." };
  redirect("/dashboard");
}

export async function exploreDemo() {
  redirect((await loginDemo()) ? "/dashboard" : "/login");
}
