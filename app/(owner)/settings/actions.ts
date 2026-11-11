"use server";

import { revalidatePath } from "next/cache";
import { requireEmployer } from "@/lib/auth";
import { db } from "@/lib/db";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The business details used in job posts, posters, the apply form and every message. */
export async function saveBusiness(form: FormData) {
  const { company } = await requireEmployer();
  const v = (k: string) => String(form.get(k) ?? "").trim() || null;
  const slot = Math.min(120, Math.max(15, parseInt(String(form.get("slot_minutes") ?? "30"), 10) || 30));
  await db.q(
    `update companies set name=$2, tagline=$3, about=$4, address=$5, city=$6, phone=$7, email=$8, website=$9, sign_as=$10, interview_location=$11, slot_minutes=$12, tone=$13 where id = $1`,
    [company.id, v("name") ?? company.name, v("tagline"), v("about"), v("address"), v("city"), v("phone"), v("email"), v("website"), v("sign_as"), v("interview_location"), slot, v("tone") ?? company.tone],
  );
  revalidatePath("/", "layout");
}

export async function saveAvailability(form: FormData) {
  const { company } = await requireEmployer();
  const rows: [number, string, string][] = [];
  for (let wd = 0; wd < 7; wd++) {
    if (form.get(`on${wd}`) !== "on") continue;
    const s = String(form.get(`s${wd}`) ?? "");
    const e = String(form.get(`e${wd}`) ?? "");
    if (TIME.test(s) && TIME.test(e) && s < e) rows.push([wd, s, e]);
  }
  await db.tx(async (t) => {
    await t.q("delete from availability where company_id = $1", [company.id]);
    for (const r of rows) await t.q("insert into availability (company_id, weekday, start_time, end_time) values ($1,$2,$3,$4)", [company.id, ...r]);
  });
  revalidatePath("/settings");
}
