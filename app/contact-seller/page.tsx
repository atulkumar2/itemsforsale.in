import { ContactSellerForm } from "@/components/contact-seller-form";
import { issueContactCaptchaChallenge } from "@/lib/contact-captcha-store";
import { SiteHeader } from "@/components/site-header";

export default function ContactSellerPage() {
  const initialChallenge = issueContactCaptchaChallenge();

  return (
    <main className="pb-16">
      <SiteHeader />

      <section className="shell py-6 md:py-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="fade-up">
            <span className="eyebrow">Contact seller</span>
            <h1 className="display-title mt-3 text-3xl font-semibold text-stone-900 md:text-4xl">
              Reach out directly
            </h1>
            <p className="mt-2 text-sm leading-7 text-[color:var(--muted)] md:text-base">
              Before showing direct contact details, we ask one tiny captcha question
              to reduce spam and bot submissions.
            </p>
          </div>

          <ContactSellerForm initialChallenge={initialChallenge} />
        </div>
      </section>
    </main>
  );
}
