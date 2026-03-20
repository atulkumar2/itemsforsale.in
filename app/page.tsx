import Link from "next/link";

import { FilterBar } from "@/components/filter-bar";
import { CatalogueView } from "@/components/catalogue-view";
import { SiteHeader } from "@/components/site-header";
import {
  getAvailableCategories,
  listPublicItems,
} from "@/lib/data/repository";
import { sellerAddress, sellerMapEmbed, sellerMapsLink } from "@/lib/seller";
import { parseItemStatus } from "@/lib/utils";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<{
    category?: string;
    q?: string;
    status?: string;
  }>;
};

function isPostgresUnavailable(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  return code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EAI_AGAIN";
}

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = {
    category: resolvedSearchParams.category?.trim() || undefined,
    query: resolvedSearchParams.q?.trim() || undefined,
    status: parseItemStatus(resolvedSearchParams.status),
  };

  let items: Awaited<ReturnType<typeof listPublicItems>> = [];
  let categories: string[] = [];
  let catalogueUnavailable = false;

  try {
    [items, categories] = await Promise.all([
      listPublicItems(filters),
      getAvailableCategories(),
    ]);
  } catch (error) {
    if (!isPostgresUnavailable(error)) {
      throw error;
    }

    catalogueUnavailable = true;
  }

  return (
    <main className="pb-16">
      <SiteHeader />
      <section className="shell grid gap-5 py-6 lg:grid-cols-[1.35fr_0.65fr] lg:py-8">
        <div className="fade-up flex flex-col gap-5">
          <span className="eyebrow">Household items for sale</span>
          <div className="space-y-4">
            <h5 className="display-title max-w-3xl text-4xl leading-tight font-semibold text-stone-900 md:text-6xl">
              Household items for sale in April 2026. 
            </h5>
            <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)]">
              To be sold by April 30th or marked sold/removed if unavailable sooner.
            </p>
            <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)]">
              Distance from various places --
            </p>
            <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)]">
              Silk Board Junctions - 3 km. Electronic City - 10 km. HSR Layout - 5 km. Koramangala - 6 km. Jayanagar - 7 km. BTM Layout - 4 km.
            </p>
            <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)]">
              Browse available items, inspect photos and details, then send a direct interest or bid request to the seller.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button" href="#listings">
              Browse items
            </Link>
            <Link className="button-secondary" href="/about-seller">
              Contact seller
            </Link>
          </div>
        </div>

        <div className="panel fade-up overflow-hidden p-4 md:p-5">
          <div className="space-y-2.5">
            <p className="eyebrow">Seller location</p>
            <h2 className="display-title text-xl font-semibold text-stone-900">
              Pickup location
            </h2>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {sellerAddress}
            </p>
            <a
              className="button-secondary"
              href={sellerMapsLink}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          </div>

          <div className="mt-4 overflow-hidden rounded-[20px] border border-[color:var(--line)]">
            <iframe
              title="Seller location map"
              src={sellerMapEmbed}
              width="100%"
              height="220"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      <section id="listings" className="shell space-y-6">
        {catalogueUnavailable ? (
          <div className="panel p-8 md:p-10">
            <p className="eyebrow">Catalogue unavailable</p>
            <h2 className="display-title mt-4 text-3xl font-semibold text-stone-900">
              Listings are temporarily unavailable.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--muted)]">
              The catalogue database is currently offline. Please try again shortly or
              use the seller page if you need to reach the seller now.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="button-secondary" href="/about-seller">
                Contact seller
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="panel p-5 md:p-6">
              <FilterBar
                categories={categories}
                initialCategory={filters.category ?? ""}
                initialQuery={filters.query ?? ""}
                initialStatus={filters.status ?? ""}
              />
            </div>

            <CatalogueView items={items} itemCount={items.length} />
          </>
        )}
      </section>
    </main>
  );
}
