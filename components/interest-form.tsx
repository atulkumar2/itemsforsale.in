"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import type { ContactCaptchaChallenge } from "@/lib/contact-captcha";
import { contactFormLimits, emailRegex, interestFormLimits, phoneRegex } from "@/lib/constants";
import {
  interestFormSchema,
  type InterestFormValues,
} from "@/lib/validation";

type InterestFormProps = {
  initialChallenge: ContactCaptchaChallenge;
  itemId: string;
  itemTitle: string;
};

export function InterestForm({ initialChallenge, itemId, itemTitle }: InterestFormProps) {
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
  } = useForm<InterestFormValues>({
    resolver: zodResolver(interestFormSchema),
    defaultValues: {
      bidPrice: "",
      buyerName: "",
      captchaAnswer: "",
      captchaToken: initialChallenge.token,
      email: "",
      itemId,
      location: "",
      message: "",
      phone: "",
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

  async function onSubmit(values: InterestFormValues) {
    setServerMessage(null);
    setServerError(null);

    startTransition(async () => {
      const response = await fetch("/api/leads", {
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
        bidPrice: "",
        buyerName: "",
        captchaAnswer: "",
        captchaToken: "",
        email: "",
        itemId,
        location: "",
        message: "",
        phone: "",
      });
      await refreshChallenge();
      setServerMessage(result.message ?? `Interest for ${itemTitle} was recorded.`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register("itemId")} value={itemId} />

      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="buyerName">
          Name
        </label>
        <input
          className="field"
          id="buyerName"
          maxLength={interestFormLimits.buyerNameMax}
          {...register("buyerName")}
        />
        {errors.buyerName ? (
          <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.buyerName.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="phone">
            Phone
          </label>
          <input
            className="field"
            id="phone"
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
          <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="email">
            Email
          </label>
          <input
            className="field"
            id="email"
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
        <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="location">
          Your location (optional)
        </label>
        <input
          className="field"
          id="location"
          maxLength={contactFormLimits.locationMax}
          placeholder="Area / locality"
          {...register("location")}
        />
        {errors.location ? (
          <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.location.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="bidPrice">
          Bid price
        </label>
        <input
          className="field"
          id="bidPrice"
          inputMode="numeric"
          maxLength={interestFormLimits.bidPriceMax}
          {...register("bidPrice")}
          placeholder="Optional"
        />
        {errors.bidPrice ? (
          <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.bidPrice.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="message">
          Message
        </label>
        <textarea
          className="textarea"
          id="message"
          maxLength={interestFormLimits.messageMax}
          {...register("message")}
        />
        {errors.message ? (
          <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.message.message}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-secondary)] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Captcha check</p>
        <p className="mt-2 text-sm font-semibold text-stone-900">
          {challenge?.prompt ?? "Loading captcha..."}
        </p>
        <input type="hidden" {...register("captchaToken")} />

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <select className="field" disabled={!challenge} {...register("captchaAnswer")}>
            <option value="">Select the correct answer</option>
            {(challenge?.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button-ghost"
            onClick={() => void refreshChallenge()}
          >
            New question
          </button>
        </div>
        {errors.captchaAnswer ? (
          <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.captchaAnswer.message}</p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-[color:var(--danger)]">{serverError}</p> : null}
      {serverMessage ? <p className="text-sm text-[color:var(--success)]">{serverMessage}</p> : null}

      <button className="button w-full" disabled={isPending || !challenge} type="submit">
        {isPending ? "Sending..." : "Submit interest"}
      </button>
    </form>
  );
}
