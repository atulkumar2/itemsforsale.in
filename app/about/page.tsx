import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn what itemsforsale.in is, why it exists, and where to find the public repository.",
};

const repoUrl = "https://github.com/atulkamble/itemsforsale.in";
const siteUrl = "https://itemsforsale.in";

export default function AboutPage() {
  return (
    <main className="pb-16">
      <SiteHeader />

      <section className="shell py-6 md:py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="fade-up">
            <span className="eyebrow">About</span>
            <h1 className="display-title mt-3 text-4xl font-semibold text-stone-900 md:text-5xl">
              About this site
            </h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-[color:var(--muted)]">
              `itemsforsale.in` is a simple personal sale board for household items.
              Buyers can browse listings, inspect details, and send direct enquiries to
              the seller without going through a large marketplace.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="panel p-6 md:p-8">
              <p className="eyebrow">What it does</p>
              <h2 className="display-title mt-4 text-3xl font-semibold text-stone-900">
                Purpose
              </h2>
              <p className="mt-4 text-base leading-8 text-[color:var(--muted)]">
                The site is focused on a small, transparent selling flow: show the
                available items, let buyers express interest, and let the seller manage
                everything from one place.
              </p>
            </div>

            <div className="panel p-6 md:p-8">
              <p className="eyebrow">Public links</p>
              <h2 className="display-title mt-4 text-3xl font-semibold text-stone-900">
                Source and site
              </h2>
              <div className="mt-4 space-y-4 text-base leading-8">
                <p className="text-[color:var(--muted)]">
                  Live site:{" "}
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-stone-900 underline decoration-[color:var(--line)] underline-offset-4"
                  >
                    {siteUrl}
                  </a>
                </p>
                <p className="text-[color:var(--muted)]">
                  Repository:{" "}
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-stone-900 underline decoration-[color:var(--line)] underline-offset-4"
                  >
                    {repoUrl}
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="panel p-6 md:p-8">
            <p className="eyebrow">How it is built</p>
            <h2 className="display-title mt-4 text-3xl font-semibold text-stone-900">
              Technical notes
            </h2>
            <div className="mt-4 space-y-4 text-base leading-8 text-[color:var(--muted)]">
              <p>
                The site is built as a single full-stack Next.js application. That means
                the frontend pages, backend API routes, validation logic, and storage
                integration live in one repository.
              </p>
              <p>
                If you want a deeper explanation of the structure, see the project
                architecture and attack-surface documents in the repository `docs`
                folder.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
