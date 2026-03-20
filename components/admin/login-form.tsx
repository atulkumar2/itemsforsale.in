"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import type { ContactCaptchaChallenge } from "@/lib/contact-captcha";
import { contactFormLimits } from "@/lib/constants";
import {
  adminLoginSchema,
  type AdminLoginValues,
} from "@/lib/validation";

type LoginFormProps = {
  initialChallenge: ContactCaptchaChallenge;
};

export function LoginForm({ initialChallenge }: LoginFormProps) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<ContactCaptchaChallenge | null>(initialChallenge);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      captchaAnswer: "",
      captchaToken: initialChallenge.token,
      email: "",
      password: "",
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

  async function onSubmit(values: AdminLoginValues) {
    setServerError(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setServerError(result.error ?? "Unable to login right now.");
        await refreshChallenge();
        return;
      }

      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="email">
          Email
        </label>
        <input className="field" id="email" {...register("email")} />
        {errors.email ? (
          <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.email.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="password">
          Password
        </label>
        <input className="field" id="password" type="password" {...register("password")} />
        {errors.password ? (
          <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.password.message}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-secondary)] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Captcha check</p>
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

      <button className="button w-full" disabled={isPending || !challenge} type="submit">
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
