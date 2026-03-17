import Link from "next/link";

import { ItemForm } from "@/components/admin/item-form";
import { SiteHeader } from "@/components/site-header";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  await requireAdminPage();

  return (
    <main className="pb-16">
      <SiteHeader compact />
      <section className="shell py-6 md:py-10">
        <div className="panel p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">New item</p>
              <h1 className="display-title mt-4 text-5xl font-semibold text-stone-900">
                Create a listing
              </h1>
              <p className="mt-3 text-[color:var(--muted)]">
                Add the item details first, then upload one or more images in the
                same form submission.
              </p>
            </div>
            <Link className="button-secondary" href="/admin">
              Back to dashboard
            </Link>
          </div>

          <div className="mt-8">
            <ItemForm />
          </div>
        </div>
      </section>
    </main>
  );
}
