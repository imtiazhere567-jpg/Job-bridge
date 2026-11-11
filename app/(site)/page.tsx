import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

/** The app opens on the sign-in page, or straight on the dashboard when already signed in. */
export default async function Home() {
  redirect((await currentUser()) ? "/dashboard" : "/login");
}
