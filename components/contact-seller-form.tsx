"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import type { ContactCaptchaChallenge } from "@/lib/contact-captcha";
import { contactFormLimits, emailRegex, phoneRegex } from "@/lib/constants";
import {
  contactSellerSchema,
  type ContactSellerValues,
} from "@/lib/validation";

const sellerContact = {
  phone: "+91 90000 00000",
  email: "itemsforsale@outlook.in",
};

type ContactSellerFormProps = {
  initialChallenge: ContactCaptchaChallenge;
};

export function ContactSellerForm({ initialChallenge }: ContactSellerFormProps) {
  const [challenge, setChallenge] = useState<ContactCaptchaChallenge | null>(initialChallenge);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ContactSellerValues>({
    resolver: zodResolver(contactSellerSchema),
    defaultValues: {
      buyerName: "",
      phone: "",
      email: "",
      location: "",
      message: "",
      captchaToken: initialChallenge.token,
      captchaAnswer: "",
    },
  });

  const watchName = useWatch({ control, name: "buyerName" });
  const watchMessage = useWatch({ control, name: "message" });

  const whatsappLink = useMemo(() => {
    const text = encodeURIComponent(
      `Hi, I am ${watchName || "a buyer"}. I am interested in your items for sale.` +
        (watchMessage ? ` Message: ${watchMessage}` : ""),
    );
    return `https://wa.me/${sellerContact.phone.replace(/\D/g, "")}?text=${text}`;
  }, [watchMessage, watchName]);

  async function refreshChallenge() {
    const response = await fetch("/api/human-check", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      setError("Unable to load captcha right now.");
      return;
    }

    const nextChallenge = (await response.json()) as ContactCaptchaChallenge;
    setChallenge(nextChallenge);
    setValue("captchaToken", nextChallenge.token, { shouldValidate: true });
    setValue("captchaAnswer", "", { shouldValidate: true });
  }

  function onSubmit(values: ContactSellerValues) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/contact-submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to submit contact request right now.");
        await refreshChallenge();
        return;
      }

      setSuccess(result.message ?? "Verified. You can now contact the seller directly.");
      reset({
        buyerName: values.buyerName,
        phone: values.phone,
        email: values.email,
        location: values.location,
        message: values.message,
        captchaToken: "",
        captchaAnswer: "",
      });
      await refreshChallenge();
    });
  }

  return (
    <div className="panel p-5 md:p-6">
      <h2 className="display-title text-2xl font-semibold text-stone-900">Contact Seller</h2>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Fill a quick enquiry and solve one simple question to verify you are human.
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="contact-name">
            Name
          </label>
          <input
            id="contact-name"
            className="field"
            maxLength={contactFormLimits.buyerNameMax}
            placeholder="Your full name"
            {...register("buyerName")}
          />
          {errors.buyerName ? (
            <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.buyerName.message}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="contact-phone">
              Phone
            </label>
            <input
              id="contact-phone"
              className="field"
              maxLength={contactFormLimits.phoneLength}
              minLength={contactFormLimits.phoneLength}
              inputMode="numeric"
              pattern={phoneRegex.source}
              placeholder="10-digit mobile number"
              {...register("phone")}
            />
            {errors.phone ? (
              <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.phone.message}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="contact-email">
              Email (optional)
            </label>
            <input
              id="contact-email"
              className="field"
              maxLength={contactFormLimits.emailMax}
              pattern={emailRegex.source}
              placeholder="you@example.com"
              {...register("email")}
            />
            {errors.email ? (
              <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.email.message}</p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="contact-location">
            Your location (optional)
          </label>
          <input
            id="contact-location"
            className="field"
            maxLength={contactFormLimits.locationMax}
            placeholder="Area / locality"
            {...register("location")}
          />
          {errors.location ? (
            <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.location.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="contact-message">
            Message
          </label>
          <textarea
            id="contact-message"
            className="textarea"
            maxLength={contactFormLimits.messageMax}
            placeholder="Tell the seller what item(s) you are interested in."
            {...register("message")}
          />
          {errors.message ? (
            <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.message.message}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-secondary)] p-3 md:p-3.5">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Captcha check</p>
      <p className="mt-1.5 text-sm font-semibold text-stone-900">
        {challenge?.prompt ?? "Loading captcha..."}
      </p>
      <input type="hidden" {...register("captchaToken")} />

      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <select className="field min-w-0" disabled={!challenge} {...register("captchaAnswer")}>
            <option value="">Select the correct answer</option>
            {(challenge?.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Load new question"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--line)] bg-white text-[color:var(--primary)] transition hover:border-[color:var(--primary)] hover:text-stone-900"
            onClick={() => void refreshChallenge()}
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path
                d="M20 12a8 8 0 1 1-2.34-5.66"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
              <path
                d="M20 4v4h-4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </div>
        {errors.captchaAnswer ? (
          <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.captchaAnswer.message}</p>
        ) : null}
      </div>

        {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
        {success ? <p className="text-sm text-[color:var(--success)]">{success}</p> : null}

        <button className="button w-full" type="submit" disabled={isPending || !challenge}>
          {isPending ? "Submitting..." : "Verify & continue"}
        </button>
      </form>

      {success ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-white p-4 md:p-5">
          <p className="text-sm font-semibold text-stone-900">Direct contact options</p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Phone: {sellerContact.phone}</p>
          <p className="text-sm text-[color:var(--muted)]">Email: {sellerContact.email}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a className="button" href={whatsappLink} target="_blank" rel="noreferrer">
              WhatsApp seller
            </a>
            <a className="button-secondary" href={`mailto:${sellerContact.email}?subject=Items%20Enquiry`}>
              Email seller
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
