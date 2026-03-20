import Link from "next/link";

import { BulkInterestForm } from "@/components/bulk-interest-form";
import { SiteHeader } from "@/components/site-header";
import { issueContactCaptchaChallenge } from "@/lib/contact-captcha-store";
import { listPublicItems } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

type ShowInterestPageProps = {
  searchParams?: Promise<{
    itemId?: string | string[];
  }>;
};

export default async function ShowInterestPage({ searchParams }: ShowInterestPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawItemIds = Array.isArray(resolvedSearchParams.itemId)
    ? resolvedSearchParams.itemId
    : resolvedSearchParams.itemId
      ? [resolvedSearchParams.itemId]
      : [];

  const selectedItemIds = Array.from(
    new Set(rawItemIds.map((itemId) => itemId.trim()).filter(Boolean)),
  );

  const allItems = await listPublicItems({});
  const selectedItems = allItems.filter((item) => selectedItemIds.includes(item.id));

  if (selectedItems.length === 0) {
    return (
      <main className="pb-16">
        <SiteHeader />
        <section className="shell py-6 md:py-10">
          <div className="panel mx-auto max-w-3xl p-6 md:p-8">
            <p className="eyebrow">Show interest</p>
            <h1 className="display-title mt-4 text-4xl font-semibold text-stone-900 md:text-5xl">
              No items selected
            </h1>
            <p className="mt-4 text-base leading-8 text-[color:var(--muted)]">
              Go back to the catalogue, select one or more items, and then continue here
              to send a combined enquiry.
            </p>
            <div className="mt-6">
              <Link className="button" href="/">
                Back to catalogue
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const initialChallenge = issueContactCaptchaChallenge();

  return (
    <main className="pb-16">
      <SiteHeader />
      <section className="shell py-6 md:py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="fade-up">
            <span className="eyebrow">Show interest</span>
            <h1 className="display-title mt-3 text-4xl font-semibold text-stone-900 md:text-5xl">
              Send one enquiry for multiple items
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[color:var(--muted)]">
              Use this form when you want to ask about several catalogue items together.
              Your enquiry will be saved as a lead for each selected item.
            </p>
          </div>

          <div className="panel p-6 md:p-8">
            <BulkInterestForm initialChallenge={initialChallenge} items={selectedItems} />
          </div>
        </div>
      </section>
    </main>
  );
}
