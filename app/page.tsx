import Link from "next/link";

import { FilterBar } from "@/components/filter-bar";
import { ItemCard } from "@/components/item-card";
import { SiteHeader } from "@/components/site-header";
import {
  getAvailableCategories,
  listPublicItems,
} from "@/lib/data/repository";
import { parseItemStatus } from "@/lib/utils";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<{
    category?: string;
    q?: string;
    status?: string;
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = {
    category: resolvedSearchParams.category?.trim() || undefined,
    query: resolvedSearchParams.q?.trim() || undefined,
    status: parseItemStatus(resolvedSearchParams.status),
  };

  const [items, categories] = await Promise.all([
    listPublicItems(filters),
    getAvailableCategories(),
  ]);

  return (
    <main className="pb-16">
      <SiteHeader />
      <section className="shell grid gap-8 py-6 lg:grid-cols-[1.2fr_0.8fr] lg:py-12">
        <div className="fade-up flex flex-col gap-6">
          <span className="eyebrow">Personal selling board</span>
          <div className="space-y-5">
            <h1 className="display-title max-w-3xl text-5xl leading-tight font-semibold text-stone-900 md:text-7xl">
              Household items, presented clearly and sold without marketplace
              noise.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
              Browse available, reserved, and sold items, inspect photos and
              history, then send a direct interest or bid request to the seller.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button" href="#listings">
              Browse items
            </Link>
            <Link className="button-secondary" href="/admin">
              Admin dashboard
            </Link>
          </div>
        </div>

        <div className="panel fade-up overflow-hidden p-6 md:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Current focus
              </p>
              <p className="mt-3 text-3xl font-semibold text-stone-900">
                Simple, fast, low-maintenance sales flow
              </p>
            </div>
            <div className="rounded-[24px] bg-[rgba(159,79,42,0.08)] p-5">
              <p className="text-sm text-[color:var(--muted)]">Included in MVP</p>
              <ul className="mt-4 space-y-3 text-sm text-stone-800">
                <li>Public item listing with search and filters</li>
                <li>Detailed item pages with photos and pricing</li>
                <li>Lead capture without buyer login</li>
                <li>Admin CRUD and local-first photo upload</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="listings" className="shell space-y-6">
        <div className="panel p-5 md:p-6">
          <FilterBar
            categories={categories}
            initialCategory={filters.category ?? ""}
            initialQuery={filters.query ?? ""}
            initialStatus={filters.status ?? ""}
          />
        </div>

        <div className="flex items-center justify-between gap-4 px-1">
          <div>
            <h2 className="display-title text-3xl font-semibold text-stone-900">
              Active catalogue
            </h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {items.length} item{items.length === 1 ? "" : "s"} matching the
              current view.
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="display-title text-3xl font-semibold text-stone-900">
              No items match those filters.
            </p>
            <p className="mt-3 text-[color:var(--muted)]">
              Clear the search or select a different status or category.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="fade-up"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <ItemCard item={item} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
