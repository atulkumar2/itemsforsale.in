import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { SiteHeader } from "@/components/site-header";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="pb-16">
      <SiteHeader compact />
      <section className="shell py-8 md:py-12">
        <div className="panel mx-auto max-w-xl p-6 md:p-8">
          <p className="eyebrow">Admin login</p>
          <h1 className="display-title mt-4 text-5xl font-semibold text-stone-900">
            Enter the admin dashboard
          </h1>
          <p className="mt-3 text-[color:var(--muted)]">
            Local development uses a cookie-backed admin session. Replace these
            credentials with Supabase-backed auth when cloud configuration is ready.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}