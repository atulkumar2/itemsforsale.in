"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { emailRegex, interestFormLimits, phoneRegex } from "@/lib/constants";
import {
  interestFormSchema,
  type InterestFormValues,
} from "@/lib/validation";

type InterestFormProps = {
  itemId: string;
  itemTitle: string;
};

export function InterestForm({ itemId, itemTitle }: InterestFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InterestFormValues>({
    resolver: zodResolver(interestFormSchema),
    defaultValues: {
      bidPrice: "",
      buyerName: "",
      email: "",
      itemId,
      message: "",
      phone: "",
    },
  });

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
        return;
      }

      reset({
        bidPrice: "",
        buyerName: "",
        email: "",
        itemId,
        message: "",
        phone: "",
      });
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

      {serverError ? <p className="text-sm text-[color:var(--danger)]">{serverError}</p> : null}
      {serverMessage ? <p className="text-sm text-[color:var(--success)]">{serverMessage}</p> : null}

      <button className="button w-full" disabled={isPending} type="submit">
        {isPending ? "Sending..." : "Submit interest"}
      </button>
    </form>
  );
}