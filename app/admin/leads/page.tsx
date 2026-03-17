import Link from "next/link";

import { LeadsTable } from "@/components/admin/leads-table";
import { LogoutButton } from "@/components/admin/logout-button";
import { SiteHeader } from "@/components/site-header";
import { requireAdminPage } from "@/lib/auth";
import { listAdminItems, listAdminLeads } from "@/lib/data/repository";

type AdminLeadsPageProps = {
  searchParams?: Promise<{
    itemId?: string;
    q?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage({ searchParams }: AdminLeadsPageProps) {
  await requireAdminPage();
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = {
    itemId: resolvedSearchParams.itemId?.trim() || undefined,
    query: resolvedSearchParams.q?.trim() || undefined,
  };

  const [leads, items] = await Promise.all([
    listAdminLeads(filters),
    listAdminItems(),
  ]);

  const exportHref = new URLSearchParams(
    Object.entries({ itemId: filters.itemId, q: filters.query }).filter(([, value]) => Boolean(value)) as [string, string][],
  ).toString();

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
          <div className="flex flex-wrap gap-3">
            <Link className="button-secondary" href={exportHref ? `/api/admin/leads/export?${exportHref}` : "/api/admin/leads/export"}>
              Export leads CSV
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="panel p-6 md:p-8">
          <form className="grid gap-4 md:grid-cols-[1fr_260px_auto]" method="get">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="q">
                Search leads
              </label>
              <input
                className="field"
                id="q"
                name="q"
                defaultValue={filters.query ?? ""}
                placeholder="Buyer, phone, email, message, or item"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="itemId">
                Filter by item
              </label>
              <select className="field" id="itemId" name="itemId" defaultValue={filters.itemId ?? ""}>
                <option value="">All items</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <button className="button" type="submit">
                Apply filters
              </button>
              <Link className="button-secondary" href="/admin/leads">
                Clear
              </Link>
            </div>
          </form>
        </div>

        <div className="panel p-6 md:p-8">
          <LeadsTable leads={leads} />
        </div>
      </section>
    </main>
  );
}