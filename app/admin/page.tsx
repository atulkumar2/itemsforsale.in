import Link from "next/link";

import { ItemTable } from "@/components/admin/item-table";
import { LeadsTable } from "@/components/admin/leads-table";
import { LogoutButton } from "@/components/admin/logout-button";
import { SiteHeader } from "@/components/site-header";
import { requireAdminPage } from "@/lib/auth";
import {
  listAdminContactSubmissions,
  listAdminItems,
  listAdminLeads,
} from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPage();

  const [items, leads, contactSubmissions] = await Promise.all([
    listAdminItems(),
    listAdminLeads(),
    listAdminContactSubmissions(),
  ]);

  return (
    <main className="pb-16">
      <SiteHeader compact />
      <section className="shell space-y-6 py-6 md:py-10">
        <div className="panel flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <p className="eyebrow">Admin dashboard</p>
            <h1 className="display-title mt-4 text-5xl font-semibold text-stone-900">
              Manage inventory, photos, and leads
            </h1>
            <p className="mt-3 max-w-2xl text-[color:var(--muted)]">
              This local-first build stores catalogue updates in a JSON data file
              so the full workflow can be tested before switching to Supabase.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="button" href="/admin/items/new">
              Add item
            </Link>
            <Link className="button-secondary" href="/admin/leads">
              View all leads
            </Link>
            <Link className="button-secondary" href="/admin/contact-submissions">
              Contact submissions
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-4">
          <div className="panel p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Total items
            </p>
            <p className="display-title mt-3 text-5xl font-semibold text-stone-900">
              {items.length}
            </p>
          </div>
          <div className="panel p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Leads captured
            </p>
            <p className="display-title mt-3 text-5xl font-semibold text-stone-900">
              {leads.length}
            </p>
          </div>
          <div className="panel p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Contact submissions
            </p>
            <p className="display-title mt-3 text-5xl font-semibold text-stone-900">
              {contactSubmissions.length}
            </p>
          </div>
          <div className="panel p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Quick status
            </p>
            <p className="mt-3 text-lg font-semibold text-stone-900">
              Local mode active, Supabase-ready structure preserved.
            </p>
          </div>
        </div>

        <div className="panel p-6 md:p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="display-title text-3xl font-semibold text-stone-900">
                Inventory
              </h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Edit details, upload more images, or remove an item.
              </p>
            </div>
          </div>
          <ItemTable items={items} />
        </div>

        <div className="panel p-6 md:p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="display-title text-3xl font-semibold text-stone-900">
                Latest leads
              </h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Recent buyer interest captured from public item pages.
              </p>
            </div>
          </div>
          <LeadsTable leads={leads.slice(0, 5)} />
        </div>
      </section>
    </main>
  );
}