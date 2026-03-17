import { LeadsTable } from "@/components/admin/leads-table";
import { LogoutButton } from "@/components/admin/logout-button";
import { SiteHeader } from "@/components/site-header";
import { requireAdminPage } from "@/lib/auth";
import { listAdminLeads } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  await requireAdminPage();
  const leads = await listAdminLeads();

  return (
    <main className="pb-16">
      <SiteHeader compact />
      <section className="shell space-y-6 py-6 md:py-10">
        <div className="panel flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <p className="eyebrow">Leads</p>
            <h1 className="display-title mt-4 text-5xl font-semibold text-stone-900">
              Buyer enquiries
            </h1>
            <p className="mt-3 text-[color:var(--muted)]">
              All submissions captured from the public interest form are listed here.
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="panel p-6 md:p-8">
          <LeadsTable leads={leads} />
        </div>
      </section>
    </main>
  );
}