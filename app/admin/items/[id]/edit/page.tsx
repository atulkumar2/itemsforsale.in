import { notFound } from "next/navigation";

import { ItemForm } from "@/components/admin/item-form";
import { SiteHeader } from "@/components/site-header";
import { requireAdminPage } from "@/lib/auth";
import { getAdminItemById } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

type EditItemPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditItemPage({ params }: EditItemPageProps) {
  await requireAdminPage();

  const { id } = await params;
  const item = await getAdminItemById(id);

  if (!item) {
    notFound();
  }

  return (
    <main className="pb-16">
      <SiteHeader compact />
      <section className="shell py-6 md:py-10">
        <div className="panel p-6 md:p-8">
          <p className="eyebrow">Edit item</p>
          <h1 className="display-title mt-4 text-5xl font-semibold text-stone-900">
            Update {item.title}
          </h1>
          <p className="mt-3 text-[color:var(--muted)]">
            Uploading additional images appends them to the current gallery.
          </p>

          <div className="mt-8">
            <ItemForm item={item} />
          </div>
        </div>
      </section>
    </main>
  );
}