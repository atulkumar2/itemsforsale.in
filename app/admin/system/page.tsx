import Link from "next/link";

import { LogoutButton } from "@/components/admin/logout-button";
import { SiteHeader } from "@/components/site-header";
import { requireAdminPage } from "@/lib/auth";
import { getAdminSystemStatus } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  await requireAdminPage();
  const status = await getAdminSystemStatus();

  return (
    <main className="pb-16">
      <SiteHeader compact />
      <section className="shell space-y-6 py-6 md:py-10">
        <div className="panel flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <p className="eyebrow">System status</p>
            <h1 className="display-title mt-4 text-5xl font-semibold text-stone-900">
              Runtime health
            </h1>
            <p className="mt-3 max-w-2xl text-[color:var(--muted)]">
              Check which storage mode is active and whether the local PostgreSQL
              connection is currently reachable.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button-secondary" href="/admin">
              Back to dashboard
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="panel p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Data mode
            </p>
            <p className="display-title mt-3 text-4xl font-semibold text-stone-900">
              {status.dataMode}
            </p>
          </div>

          <div className="panel p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Persistence
            </p>
            <p className="display-title mt-3 text-4xl font-semibold text-stone-900">
              {status.persistence}
            </p>
          </div>

          <div className="panel p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Upload storage
            </p>
            <p className="display-title mt-3 text-4xl font-semibold text-stone-900">
              {status.uploadsStorage}
            </p>
          </div>

          <div className="panel p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
              PostgreSQL
            </p>
            <p className="mt-3 text-lg font-semibold text-stone-900">
              {status.postgres.reachable === null
                ? "Inactive in current mode"
                : status.postgres.reachable
                  ? "Reachable"
                  : "Unavailable"}
            </p>
            {status.postgres.error ? (
              <p className="mt-2 text-sm text-[color:var(--danger)]">{status.postgres.error}</p>
            ) : null}
          </div>
        </div>

        <div className="panel p-6 md:p-8">
          <h2 className="display-title text-3xl font-semibold text-stone-900">
            Connection details
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Host
              </p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {status.databaseTarget?.host ?? "Not in postgres mode"}
              </p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Port
              </p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {status.databaseTarget?.port ?? "Not in postgres mode"}
              </p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Database
              </p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {status.databaseTarget?.database ?? "Not in postgres mode"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
