import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ItemGallery } from "@/components/item-gallery";
import { InterestForm } from "@/components/interest-form";
import { SiteHeader } from "@/components/site-header";
import { issueContactCaptchaChallenge } from "@/lib/contact-captcha-store";
import { StatusBadge } from "@/components/status-badge";
import { getPublicItemBySlug } from "@/lib/data/repository";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ItemPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function isPostgresUnavailable(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  return code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EAI_AGAIN";
}

export async function generateMetadata({ params }: ItemPageProps): Promise<Metadata> {
  const { slug } = await params;
  let item = null;
  let catalogueUnavailable = false;

  try {
    item = await getPublicItemBySlug(slug);
  } catch (error) {
    if (!isPostgresUnavailable(error)) {
      throw error;
    }

    catalogueUnavailable = true;
  }

  if (catalogueUnavailable) {
    return {
      title: "Catalogue unavailable",
      description: "The item catalogue is temporarily unavailable.",
    };
  }

  if (!item) {
    return {
      title: "Item not found",
    };
  }

  return {
    title: item.title,
    description: item.description || `View details and submit interest for ${item.title}.`,
  };
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { slug } = await params;
  let item = null;
  let catalogueUnavailable = false;

  try {
    item = await getPublicItemBySlug(slug);
  } catch (error) {
    if (!isPostgresUnavailable(error)) {
      throw error;
    }

    catalogueUnavailable = true;
  }

  if (catalogueUnavailable) {
    return (
      <main className="pb-16">
        <SiteHeader compact />
        <section className="shell py-6 lg:py-10">
          <div className="panel p-8 md:p-10">
            <p className="eyebrow">Item unavailable</p>
            <h1 className="display-title mt-4 text-4xl font-semibold text-stone-900">
              This item page is temporarily unavailable.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--muted)]">
              The catalogue database is currently offline, so item details cannot be
              loaded right now. Please try again shortly.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!item) {
    notFound();
  }

  const initialChallenge = issueContactCaptchaChallenge();

  return (
    <main className="pb-16">
      <SiteHeader compact />
      <section className="shell grid gap-5 py-6 lg:items-start lg:grid-cols-[1fr_1fr] lg:py-8">
        <div className="panel overflow-hidden">
          <ItemGallery item={item} />
        </div>

        <div className="space-y-5">
          <div className="panel p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Item detail</p>
                <h1 className="display-title mt-2 text-3xl font-semibold leading-tight text-stone-900 md:text-[2.9rem]">
                  {item.title}
                </h1>
              </div>
              <StatusBadge status={item.status} />
            </div>

            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] md:text-base">
              {item.description || "No description added yet."}
            </p>

            <dl className="mt-5 grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-[18px] bg-[rgba(255,248,241,0.84)] p-3">
                <dt className="text-sm text-[color:var(--muted)]">Category</dt>
                <dd className="mt-1 font-semibold text-stone-900">{item.category || "Uncategorised"}</dd>
              </div>
              <div className="rounded-[18px] bg-[rgba(255,248,241,0.84)] p-3">
                <dt className="text-sm text-[color:var(--muted)]">Condition</dt>
                <dd className="mt-1 font-semibold text-stone-900">{item.condition || "Not specified"}</dd>
              </div>
              <div className="rounded-[18px] bg-[rgba(255,248,241,0.84)] p-3">
                <dt className="text-sm text-[color:var(--muted)]">Expected price</dt>
                <dd className="mt-1 font-semibold text-stone-900">
                  {formatCurrency(item.expectedPrice)}
                </dd>
              </div>
              <div className="rounded-[18px] bg-[rgba(255,248,241,0.84)] p-3">
                <dt className="text-sm text-[color:var(--muted)]">Purchase price</dt>
                <dd className="mt-1 font-semibold text-stone-900">
                  {formatCurrency(item.purchasePrice)}
                </dd>
              </div>
              <div className="rounded-[18px] bg-[rgba(255,248,241,0.84)] p-3">
                <dt className="text-sm text-[color:var(--muted)]">Purchase date</dt>
                <dd className="mt-1 font-semibold text-stone-900">{formatDate(item.purchaseDate)}</dd>
              </div>
              <div className="rounded-[18px] bg-[rgba(255,248,241,0.84)] p-3">
                <dt className="text-sm text-[color:var(--muted)]">Available from</dt>
                <dd className="mt-1 font-semibold text-stone-900">{formatDate(item.availableFrom)}</dd>
              </div>
              <div className="rounded-[18px] bg-[rgba(255,248,241,0.84)] p-3 sm:col-span-2">
                <dt className="text-sm text-[color:var(--muted)]">Location</dt>
                <dd className="mt-1 font-semibold text-stone-900">
                  {item.locationArea ? (
                    item.locationArea
                  ) : (
                    <Link className="text-[color:var(--primary)] hover:underline" href="/about-seller">
                      See seller location and contact details
                    </Link>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="panel p-5 md:p-6">
            <div className="space-y-1.5">
              <p className="eyebrow">Send interest</p>
              <h2 className="display-title text-2xl font-semibold text-stone-900">
                Ask about this item
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                Send a quick enquiry or offer.
              </p>
            </div>

            <div className="mt-5">
              <InterestForm
                initialBidPrice={item.expectedPrice?.toString() ?? ""}
                initialChallenge={initialChallenge}
                itemId={item.id}
                itemTitle={item.title}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
