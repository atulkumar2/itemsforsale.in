import type { Metadata } from "next";

import { ContactSellerForm } from "@/components/contact-seller-form";
import { SiteHeader } from "@/components/site-header";
import { issueContactCaptchaChallenge } from "@/lib/contact-captcha-store";
import {
  sellerAddress,
  sellerDistanceRows,
  sellerMapEmbed,
  sellerMapsLink,
} from "@/lib/seller";

export const metadata: Metadata = {
  title: "About Seller",
  description: "Seller details, pickup location, map link, and contact form.",
};

export default function AboutSellerPage() {
  const initialChallenge = issueContactCaptchaChallenge();

  return (
    <main className="pb-16">
      <SiteHeader />

      <section className="shell py-6 md:py-8">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <div className="panel p-5 md:p-6">
              <p className="eyebrow">About seller</p>
              <h1 className="display-title mt-3 text-3xl font-semibold text-stone-900 md:text-4xl">
                Seller details and pickup location
              </h1>
              <p className="mt-3 text-sm leading-7 text-[color:var(--muted)] md:text-base">
                Use this page to check the pickup area, open the location in Google Maps,
                and contact the seller directly.
              </p>

              <div className="mt-5 rounded-[20px] border border-[color:var(--line)] bg-[rgba(255,248,241,0.64)] p-4">
                <p className="text-sm font-semibold text-stone-900">Pickup address</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                  {sellerAddress}
                </p>
                <a
                  className="mt-4 inline-flex items-center rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
                  href={sellerMapsLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
              </div>
            </div>

            <div className="panel overflow-hidden p-4 md:p-5">
              <p className="eyebrow">Distances</p>
              <div className="mt-3 overflow-hidden rounded-[20px] border border-[color:var(--line)]">
                <table className="w-full text-left text-sm text-stone-900">
                  <thead className="bg-[color:var(--bg-secondary)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Place</th>
                      <th className="px-4 py-3 font-semibold">Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellerDistanceRows.map((row) => (
                      <tr key={row.place} className="border-t border-[color:var(--line)]">
                        <td className="px-4 py-3">{row.place}</td>
                        <td className="px-4 py-3 font-semibold">{row.distance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel overflow-hidden p-4 md:p-5">
              <iframe
                title="Seller location map"
                src={sellerMapEmbed}
                width="100%"
                height="280"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="overflow-hidden rounded-[20px] border border-[color:var(--line)]"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="fade-up">
              <span className="eyebrow">Contact seller</span>
              <h2 className="display-title mt-3 text-3xl font-semibold text-stone-900 md:text-4xl">
                Reach out directly
              </h2>
              <p className="mt-2 text-sm leading-7 text-[color:var(--muted)] md:text-base">
                Before showing direct contact details, we ask one tiny captcha question
                to reduce spam and bot submissions.
              </p>
            </div>

            <ContactSellerForm initialChallenge={initialChallenge} />
          </div>
        </div>
      </section>
    </main>
  );
}
