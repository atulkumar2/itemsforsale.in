"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    });
  }

  return (
    <button className="button-ghost" disabled={isPending} onClick={handleLogout} type="button">
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}