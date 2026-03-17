import Link from "next/link";

import { FilterBar } from "@/components/filter-bar";
import { CatalogueView } from "@/components/catalogue-view";
import { SiteHeader } from "@/components/site-header";
import {
  getAvailableCategories,
  listPublicItems,
} from "@/lib/data/repository";
import { parseItemStatus } from "@/lib/utils";

export const dynamic = "force-dynamic";

const sellerAddress =
  "Pioneer Wood winds Apartment, 1st Main, 3rd Cross, BTM 4th Stage, Near Bus Stop, SBI Colony, Devarachiknahalli, Bommanahalli, Bengaluru, Karnataka 560076";
const sellerMapsLink = "https://maps.app.goo.gl/dnveXLxu6jniBJHv6";
const sellerMapEmbed =
  "https://www.google.com/maps?q=Pioneer%20Wood%20winds%20Apartment%2C%201st%20Main%2C%203rd%20Cross%2C%20BTM%204th%20Stage%2C%20Near%20Bus%20Stop%2C%20SBI%20Colony%2C%20Devarachiknahalli%2C%20Bommanahalli%2C%20Bengaluru%2C%20Karnataka%20560076&output=embed";

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
          <span className="eyebrow">Household items for sale</span>
          <div className="space-y-5">
            <h5 className="display-title max-w-3xl text-5xl leading-tight font-semibold text-stone-900 md:text-7xl">
              Household items for sale in April 2026. 
            </h5>
            <p className="max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
              To be sold by April 30th or marked sold/removed if unavailable sooner.
            </p>
            <p className="max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
              Distance from various places --
            </p>
            <p className="max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
              Silk Board Junctions - 3 km. Electronic City - 10 km. HSR Layout - 5 km. Koramangala - 6 km. Jayanagar - 7 km. BTM Layout - 4 km.
            </p>
            <p className="max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
              Browse available, reserved, and sold items, inspect photos and
              history, then send a direct interest or bid request to the seller.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button" href="#listings">
              Browse items
            </Link>
            <Link className="button-secondary" href="/contact-seller">
              Contact seller
            </Link>
            <Link className="button-secondary" href="/admin">
              Admin dashboard
            </Link>
          </div>
        </div>

        <div className="panel fade-up overflow-hidden p-6 md:p-8">
          <div className="space-y-4">
            <p className="eyebrow">Seller location</p>
            <h2 className="display-title text-3xl font-semibold text-stone-900">
              Visit or inspect pickup point on map
            </h2>
            <p className="text-sm leading-7 text-[color:var(--muted)]">
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

          <div className="mt-5 overflow-hidden rounded-[24px] border border-[color:var(--line)]">
            <iframe
              title="Seller location map"
              src={sellerMapEmbed}
              width="100%"
              height="280"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
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

        <CatalogueView items={items} itemCount={items.length} />
      </section>
    </main>
  );
}
