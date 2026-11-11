import { redirect } from "next/navigation";

/** The public job list was removed: applicants arrive through a job's apply link or the website form. */
export default function Jobs() {
  redirect("/");
}
