import { db } from "@/lib/db";
import type { User } from "@/lib/types";
import { Sidebar } from "./sidebar";

/**
 * The signed-in layout: navy sidebar on the left, page on the right.
 * Used by the dashboard and by the careers pages whenever the owner is signed in.
 */
export async function AppShell({ user, children, bare = false }: { user: User; children: React.ReactNode; bare?: boolean }) {
  const counts = (await db.one<Record<string, number>>(
    `select (select count(*)::int from applicants a join roles r on r.id = a.role_id where a.stage = 'applied' and r.status = 'open') as applicants,
            (select count(*)::int from interviews where status = 'booked' and starts_at > now()) as interviews,
            (select count(*)::int from (select distinct on (applicant_id) direction from messages where channel = 'whatsapp'
               order by applicant_id, created_at desc, id desc) latest where direction = 'in') as unread`,
  )) ?? {};
  return (
    <div className="min-h-screen bg-pearl lg:flex">
      <Sidebar user={user.name} counts={counts} />
      {bare ? (
        // Careers pages bring their own spacing and full-width bands.
        <main className="min-w-0 flex-1">{children}</main>
      ) : (
        <main className="min-w-0 flex-1 px-4 py-7 sm:px-8 lg:px-10 lg:py-9">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      )}
    </div>
  );
}
