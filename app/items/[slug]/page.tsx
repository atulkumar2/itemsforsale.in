import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

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

  const heroImage = item.images[0]?.imageUrl ?? "/placeholder-chair.svg";
  const initialChallenge = issueContactCaptchaChallenge();

  return (
    <main className="pb-16">
      <SiteHeader compact />
      <section className="shell grid gap-6 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-10">
        <div className="panel overflow-hidden">
          <div className="relative aspect-[4/3] w-full bg-[rgba(216,185,143,0.18)]">
            <Image
              src={heroImage}
              alt={item.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-3 md:p-6">
            {item.images.length > 0 ? (
              item.images.map((image) => (
                <div
                  key={image.id}
                  className="relative aspect-[4/3] overflow-hidden rounded-[22px] border border-[color:var(--line)] bg-[rgba(216,185,143,0.16)]"
                >
                  <Image
                    src={image.imageUrl}
                    alt={`${item.title} image`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 20vw"
                  />
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-[color:var(--line)] p-6 text-sm text-[color:var(--muted)] md:col-span-3">
                No images uploaded yet for this item.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Item detail</p>
                <h1 className="display-title mt-4 text-5xl font-semibold text-stone-900">
                  {item.title}
                </h1>
              </div>
              <StatusBadge status={item.status} />
            </div>

            <p className="mt-5 text-base leading-8 text-[color:var(--muted)]">
              {item.description || "No description added yet."}
            </p>

            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] bg-[rgba(255,248,241,0.84)] p-4">
                <dt className="text-sm text-[color:var(--muted)]">Category</dt>
                <dd className="mt-1 font-semibold text-stone-900">{item.category || "Uncategorised"}</dd>
              </div>
              <div className="rounded-[22px] bg-[rgba(255,248,241,0.84)] p-4">
                <dt className="text-sm text-[color:var(--muted)]">Condition</dt>
                <dd className="mt-1 font-semibold text-stone-900">{item.condition || "Not specified"}</dd>
              </div>
              <div className="rounded-[22px] bg-[rgba(255,248,241,0.84)] p-4">
                <dt className="text-sm text-[color:var(--muted)]">Expected price</dt>
                <dd className="mt-1 font-semibold text-stone-900">
                  {formatCurrency(item.expectedPrice)}
                </dd>
              </div>
              <div className="rounded-[22px] bg-[rgba(255,248,241,0.84)] p-4">
                <dt className="text-sm text-[color:var(--muted)]">Purchase price</dt>
                <dd className="mt-1 font-semibold text-stone-900">
                  {formatCurrency(item.purchasePrice)}
                </dd>
              </div>
              <div className="rounded-[22px] bg-[rgba(255,248,241,0.84)] p-4">
                <dt className="text-sm text-[color:var(--muted)]">Purchase date</dt>
                <dd className="mt-1 font-semibold text-stone-900">{formatDate(item.purchaseDate)}</dd>
              </div>
              <div className="rounded-[22px] bg-[rgba(255,248,241,0.84)] p-4">
                <dt className="text-sm text-[color:var(--muted)]">Available from</dt>
                <dd className="mt-1 font-semibold text-stone-900">{formatDate(item.availableFrom)}</dd>
              </div>
              <div className="rounded-[22px] bg-[rgba(255,248,241,0.84)] p-4 sm:col-span-2">
                <dt className="text-sm text-[color:var(--muted)]">Location</dt>
                <dd className="mt-1 font-semibold text-stone-900">
                  {item.locationArea || "Location not listed"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="panel p-6 md:p-8">
            <div className="space-y-2">
              <p className="eyebrow">Send interest</p>
              <h2 className="display-title text-3xl font-semibold text-stone-900">
                Ask about this item or make an offer
              </h2>
              <p className="text-sm leading-7 text-[color:var(--muted)]">
                No buyer account is required. The message goes directly into the
                admin leads view.
              </p>
            </div>

            <div className="mt-6">
              <InterestForm
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
