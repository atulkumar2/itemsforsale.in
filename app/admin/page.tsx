import Link from "next/link";

import { ItemTable } from "@/components/admin/item-table";
import { LeadsTable } from "@/components/admin/leads-table";
import { LogoutButton } from "@/components/admin/logout-button";
import { SiteHeader } from "@/components/site-header";
import { requireAdminPage } from "@/lib/auth";
import {
  getAdminSystemStatus,
  listAdminContactSubmissions,
  listAdminItems,
  listAdminLeads,
} from "@/lib/data/repository";

export const dynamic = "force-dynamic";

function isPostgresUnavailable(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  return code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EAI_AGAIN";
}

export default async function AdminPage() {
  await requireAdminPage();

  let items: Awaited<ReturnType<typeof listAdminItems>> = [];
  let leads: Awaited<ReturnType<typeof listAdminLeads>> = [];
  let contactSubmissions: Awaited<ReturnType<typeof listAdminContactSubmissions>> = [];
  let systemStatus: Awaited<ReturnType<typeof getAdminSystemStatus>> = await getAdminSystemStatus();
  let adminUnavailable = false;

  try {
    [items, leads, contactSubmissions, systemStatus] = await Promise.all([
      listAdminItems(),
      listAdminLeads(),
      listAdminContactSubmissions(),
      getAdminSystemStatus(),
    ]);
  } catch (error) {
    if (!isPostgresUnavailable(error)) {
      throw error;
    }

    adminUnavailable = true;
  }

  const leadCountByItemId = leads.reduce<Record<string, number>>((acc, lead) => {
    acc[lead.itemId] = (acc[lead.itemId] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="pb-16">
      <SiteHeader compact />
      <section className="shell space-y-5 py-6 md:py-8">
        <div className="panel flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-6">
          <div>
            <p className="eyebrow">Admin dashboard</p>
            <h1 className="display-title mt-3 text-4xl font-semibold text-stone-900 md:text-[2.6rem]">
              Manage inventory, photos, and leads
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--muted)] md:text-base">
              This local-first build supports JSON or PostgreSQL storage so the
              full workflow can be tested before switching to Supabase.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="button" href="/admin/items/new">
              Add item
            </Link>
            <LogoutButton />
          </div>
        </div>

        {adminUnavailable ? (
          <div className="panel p-6 md:p-8">
            <p className="eyebrow">Admin unavailable</p>
            <h2 className="display-title mt-3 text-2xl font-semibold text-stone-900">
              PostgreSQL is currently unavailable.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--muted)] md:text-base">
              Admin inventory, leads, and contact submissions cannot be loaded until
              the database connection is restored.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="button-secondary" href="/admin/system">
                View system status
              </Link>
              <LogoutButton />
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="panel p-5">
                <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Total items
                </p>
                <p className="display-title mt-2 text-4xl font-semibold text-stone-900">
                  {items.length}
                </p>
              </div>
              <div className="panel p-5">
                <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Leads captured
                </p>
                <p className="display-title mt-2 text-4xl font-semibold text-stone-900">
                  {leads.length}
                </p>
              </div>
              <div className="panel p-5">
                <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Contact submissions
                </p>
                <p className="display-title mt-2 text-4xl font-semibold text-stone-900">
                  {contactSubmissions.length}
                </p>
              </div>
              <div className="panel p-5">
                <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Quick status
                </p>
                <p className="mt-2 text-base font-semibold text-stone-900">
                  {systemStatus.dataMode === "postgres"
                    ? systemStatus.postgres.reachable
                      ? "PostgreSQL mode active and reachable."
                      : "PostgreSQL mode active but currently unavailable."
                    : "JSON mode active with local filesystem uploads."}
                </p>
                <Link className="mt-4 inline-block text-sm text-[color:var(--primary)] hover:underline" href="/admin/system">
                  View system details
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Link
                className="panel block p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--primary)]"
                href="/admin/leads"
              >
                <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Leads
                </p>
                <p className="mt-2 text-xl font-semibold text-stone-900">View all leads</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Review buyer bids, expected prices, and recent interest across items.
                </p>
              </Link>

              <Link
                className="panel block p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--primary)]"
                href="/admin/contact-submissions"
              >
                <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Contact
                </p>
                <p className="mt-2 text-xl font-semibold text-stone-900">Contact submissions</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Check direct-contact requests submitted from the public contact page.
                </p>
              </Link>

              <Link
                className="panel block p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--primary)]"
                href="/admin/system"
              >
                <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  System
                </p>
                <p className="mt-2 text-xl font-semibold text-stone-900">System status</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  Inspect the active data mode, upload storage, and PostgreSQL reachability.
                </p>
              </Link>
            </div>

            <div className="panel p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="display-title text-2xl font-semibold text-stone-900">
                    Inventory
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    Edit details, upload more images, or remove an item.
                  </p>
                </div>
                <Link className="button-secondary" href="/api/catalogue/export">
                  Export catalogue CSV
                </Link>
              </div>
              <ItemTable items={items} leadCountByItemId={leadCountByItemId} />
            </div>

            <div className="panel p-5 md:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="display-title text-2xl font-semibold text-stone-900">
                    Latest leads
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    Recent buyer interest captured from public item pages.
                  </p>
                </div>
              </div>
              <LeadsTable leads={leads.slice(0, 5)} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
