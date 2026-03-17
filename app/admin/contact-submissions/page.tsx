import { ContactSubmissionsTable } from "@/components/admin/contact-submissions-table";
import { LogoutButton } from "@/components/admin/logout-button";
import { SiteHeader } from "@/components/site-header";
import { requireAdminPage } from "@/lib/auth";
import { listAdminContactSubmissions } from "@/lib/data/repository";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminContactSubmissionsPage() {
  await requireAdminPage();
  const submissions = await listAdminContactSubmissions();

  return (
    <main className="pb-16">
      <SiteHeader compact />
      <section className="shell space-y-6 py-6 md:py-10">
        <div className="panel flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <p className="eyebrow">Contact Seller Submissions</p>
            <h1 className="display-title mt-4 text-5xl font-semibold text-stone-900">
              Direct contact enquiries
            </h1>
            <p className="mt-3 text-[color:var(--muted)]">
              Every submission from the Contact Seller page is listed here with message and verified captcha prompt.
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="panel p-6 md:p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="display-title text-3xl font-semibold text-stone-900">
                Submission log
              </h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Download a CSV snapshot for backup or offline analysis.
              </p>
            </div>
            <Link className="button-secondary" href="/api/admin/contact-submissions/export">
              Export CSV
            </Link>
          </div>
          <ContactSubmissionsTable submissions={submissions} />
        </div>
      </section>
    </main>
  );
}
