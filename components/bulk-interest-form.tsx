"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import type { ContactCaptchaChallenge } from "@/lib/contact-captcha";
import { contactFormLimits, emailRegex, interestFormLimits, phoneRegex } from "@/lib/constants";
import type { ItemWithImages } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  bulkInterestFormSchema,
  type BulkInterestFormValues,
} from "@/lib/validation";

type BulkInterestFormProps = {
  initialChallenge: ContactCaptchaChallenge;
  items: ItemWithImages[];
};

export function BulkInterestForm({ initialChallenge, items }: BulkInterestFormProps) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<ContactCaptchaChallenge | null>(initialChallenge);
  const [isPending, startTransition] = useTransition();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<BulkInterestFormValues>({
    resolver: zodResolver(bulkInterestFormSchema),
    defaultValues: {
      itemIds: items.map((item) => item.id),
      buyerName: "",
      phone: "",
      email: "",
      location: "",
      message: "",
      captchaToken: initialChallenge.token,
      captchaAnswer: "",
    },
  });

  async function refreshChallenge() {
    const response = await fetch("/api/human-check", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      setServerError("Unable to load captcha right now.");
      return;
    }

    const nextChallenge = (await response.json()) as ContactCaptchaChallenge;
    setChallenge(nextChallenge);
    setValue("captchaToken", nextChallenge.token, { shouldValidate: true });
    setValue("captchaAnswer", "", { shouldValidate: true });
  }

  async function onSubmit(values: BulkInterestFormValues) {
    setServerError(null);
    setServerMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/bulk-leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setServerError(result.error ?? "Unable to submit interest right now.");
        await refreshChallenge();
        return;
      }

      reset({
        itemIds: items.map((item) => item.id),
        buyerName: "",
        phone: "",
        email: "",
        location: "",
        message: "",
        captchaToken: "",
        captchaAnswer: "",
      });
      await refreshChallenge();
      setServerMessage(result.message ?? "Interest submitted successfully.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[22px] border border-[color:var(--line)] bg-[rgba(255,248,241,0.64)] p-5">
        <p className="eyebrow">Selected items</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[color:var(--line)] bg-white">
          <table className="w-full min-w-[680px] text-sm text-stone-900">
            <thead className="bg-[color:var(--bg-secondary)] text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-stone-900">Item</th>
                <th className="px-4 py-3 font-semibold text-stone-900">Price</th>
                <th className="px-4 py-3 font-semibold text-stone-900">Available</th>
                <th className="px-4 py-3 font-semibold text-stone-900">Category</th>
                <th className="px-4 py-3 font-semibold text-stone-900">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[color:var(--line)] align-top">
                  <td className="px-4 py-3 font-medium text-stone-900">{item.title}</td>
                  <td className="px-4 py-3">{formatCurrency(item.expectedPrice)}</td>
                  <td className="px-4 py-3">{formatDate(item.availableFrom)}</td>
                  <td className="px-4 py-3 text-[color:var(--muted)]">{item.category || "General"}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-[color:var(--primary)] underline decoration-[color:var(--line)]"
                      href={`/items/${item.slug}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open item
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {items.map((item) => (
          <input key={item.id} type="hidden" value={item.id} {...register("itemIds")} />
        ))}

        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="bulk-buyerName">
            Name
          </label>
          <input
            className="field"
            id="bulk-buyerName"
            maxLength={interestFormLimits.buyerNameMax}
            {...register("buyerName")}
          />
          {errors.buyerName ? (
            <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.buyerName.message}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="bulk-phone">
              Phone
            </label>
            <input
              className="field"
              id="bulk-phone"
              maxLength={interestFormLimits.phoneLength}
              minLength={interestFormLimits.phoneLength}
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
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="bulk-email">
              Email
            </label>
            <input
              className="field"
              id="bulk-email"
              maxLength={interestFormLimits.emailMax}
              pattern={emailRegex.source}
              {...register("email")}
            />
            {errors.email ? (
              <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.email.message}</p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="bulk-location">
            Your location (optional)
          </label>
          <input
            className="field"
            id="bulk-location"
            maxLength={contactFormLimits.locationMax}
            placeholder="Area / locality"
            {...register("location")}
          />
          {errors.location ? (
            <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.location.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="bulk-message">
            Message
          </label>
          <textarea
            className="textarea"
            id="bulk-message"
            maxLength={interestFormLimits.messageMax}
            placeholder="Tell the seller which items you want to inspect or ask about."
            {...register("message")}
          />
          {errors.message ? (
            <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.message.message}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-secondary)] p-3 md:p-3.5">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Human check</p>
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
              aria-label="Load new question"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--line)] bg-white text-[color:var(--primary)] transition hover:border-[color:var(--primary)] hover:text-stone-900"
              onClick={() => void refreshChallenge()}
              type="button"
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
          {errors.itemIds ? (
            <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.itemIds.message}</p>
          ) : null}
        </div>

        {serverError ? <p className="text-sm text-[color:var(--danger)]">{serverError}</p> : null}
        {serverMessage ? <p className="text-sm text-[color:var(--success)]">{serverMessage}</p> : null}

        <button className="button w-full" disabled={isPending || !challenge} type="submit">
          {isPending ? "Sending..." : `Submit interest for ${items.length} item${items.length === 1 ? "" : "s"}`}
        </button>
      </form>
    </div>
  );
}
