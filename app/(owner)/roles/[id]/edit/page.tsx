import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HeroHeader } from "@/components/ui";
import { requireEmployer } from "@/lib/auth";
import { roleByParam } from "@/lib/owner";
import { RoleForm } from "../../role-form";
import { updateRole } from "../../actions";

export const metadata = { title: "Edit job" };

export default async function EditRole({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await requireEmployer();
  const role = await roleByParam(id, company.id, "/edit");
  return (
    <>
      <Link href={`/roles/${role.slug}`} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate hover:text-lagoon"><ArrowLeft size={14} /> {role.title}</Link>
      <HeroHeader eyebrow="Edit job" title={role.title} sub="Changes apply to new applicants straight away. Tick re-score to update the existing ones too." />
      <RoleForm action={updateRole.bind(null, role.id)} role={role} submitLabel="Save changes" showRescore />
    </>
  );
}
