import Image from "next/image";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import type { ItemWithImages } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type ItemCardProps = {
  item: ItemWithImages;
};

export function ItemCard({ item }: ItemCardProps) {
  const imageUrl = item.images[0]?.imageUrl ?? "/placeholder-chair.svg";

  return (
    <article className="panel overflow-hidden">
      <div className="relative aspect-[4/3] bg-[rgba(216,185,143,0.18)]">
        <Image
          src={imageUrl}
          alt={item.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </div>

      <div className="space-y-5 p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.14em] text-[color:var(--muted)]">
              {item.category || "General"}
            </p>
            <h3 className="display-title mt-2 text-3xl font-semibold text-stone-900">
              {item.title}
            </h3>
          </div>
          <StatusBadge status={item.status} />
        </div>

        <dl className="grid gap-3 text-sm text-stone-800 sm:grid-cols-2">
          <div>
            <dt className="text-[color:var(--muted)]">Expected price</dt>
            <dd className="mt-1 font-semibold">{formatCurrency(item.expectedPrice)}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--muted)]">Purchase date</dt>
            <dd className="mt-1 font-semibold">{formatDate(item.purchaseDate)}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--muted)]">Available from</dt>
            <dd className="mt-1 font-semibold">{formatDate(item.availableFrom)}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--muted)]">Condition</dt>
            <dd className="mt-1 font-semibold">{item.condition || "Not specified"}</dd>
          </div>
        </dl>

        <Link className="button w-full" href={`/items/${item.slug}`}>
          View details
        </Link>
      </div>
    </article>
  );
}