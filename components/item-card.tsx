import Image from "next/image";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import type { ItemWithImages } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type ItemCardProps = {
  item: ItemWithImages;
  isSelected?: boolean;
  onToggleSelection?: (itemId: string) => void;
};

export function ItemCard({ item, isSelected = false, onToggleSelection }: ItemCardProps) {
  const imageUrl = item.images[0]?.thumbnailUrl ?? item.images[0]?.imageUrl ?? "/placeholder-chair.svg";
  const galleryPreview =
    item.images.length > 0
      ? item.images.slice(0, 3)
      : [
          {
            id: "fallback-1",
            imageUrl: "/placeholder-chair.svg",
            thumbnailUrl: "/placeholder-chair.svg",
          },
        ];

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

      <div className="grid grid-cols-3 gap-2 border-y border-[color:var(--line)] bg-[rgba(255,248,241,0.64)] p-2">
        {galleryPreview.map((image) => (
          <div
            key={image.id}
            className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[color:var(--line)]"
          >
            <Image
              src={image.thumbnailUrl ?? image.imageUrl}
              alt={`${item.title} gallery`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 30vw, 10vw"
            />
          </div>
        ))}
      </div>

      <div className="space-y-4 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.14em] text-[color:var(--muted)]">
              {item.category || "General"}
            </p>
            <h3 className="display-title mt-2 text-2xl font-semibold text-stone-900">
              {item.title}
            </h3>
            <p className="mt-2 text-sm font-medium text-[color:var(--muted)]">
              {item.images.length} photo{item.images.length === 1 ? "" : "s"} available
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <StatusBadge status={item.status} />
            {onToggleSelection ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-900">
                <input
                  checked={isSelected}
                  className="h-4 w-4 accent-[color:var(--primary)]"
                  onChange={() => onToggleSelection(item.id)}
                  type="checkbox"
                />
                Select
              </label>
            ) : null}
          </div>
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

        <Link className="button w-full" href={`/items/${item.slug}`} rel="noreferrer" target="_blank">
          View details
        </Link>
      </div>
    </article>
  );
}
