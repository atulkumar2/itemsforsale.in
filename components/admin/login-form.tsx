"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import {
  adminLoginSchema,
  type AdminLoginValues,
} from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

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

      {serverError ? <p className="text-sm text-[color:var(--danger)]">{serverError}</p> : null}

      <button className="button w-full" disabled={isPending} type="submit">
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}