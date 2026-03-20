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
        <ul className="mt-4 space-y-3 text-sm text-stone-900">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-[color:var(--line)] bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-[color:var(--muted)]">
                    {item.category || "General"}
                  </p>
                </div>
                <Link
                  className="text-sm font-medium text-[color:var(--primary)] underline decoration-[color:var(--line)]"
                  href={`/items/${item.slug}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open item
                </Link>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[color:var(--muted)]">Price</dt>
                  <dd className="font-medium text-stone-900">{formatCurrency(item.expectedPrice)}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--muted)]">Available</dt>
                  <dd className="font-medium text-stone-900">{formatDate(item.availableFrom)}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--muted)]">Category</dt>
                  <dd className="font-medium text-stone-900">{item.category || "General"}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--muted)]">Item link</dt>
                  <dd>
                    <Link
                      className="font-medium text-[color:var(--primary)] underline decoration-[color:var(--line)]"
                      href={`/items/${item.slug}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      /items/{item.slug}
                    </Link>
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
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

        <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-secondary)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Human check</p>
          <p className="mt-2 text-sm font-semibold text-stone-900">
            {challenge?.prompt ?? "Loading captcha..."}
          </p>
          <input type="hidden" {...register("captchaToken")} />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              className="field"
              disabled={!challenge}
              maxLength={contactFormLimits.captchaAnswerMax}
              placeholder="Type your answer"
              {...register("captchaAnswer")}
            />
            <button className="button-ghost" onClick={() => void refreshChallenge()} type="button">
              New question
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
