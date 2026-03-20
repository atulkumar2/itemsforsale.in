"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { ItemWithImages } from "@/lib/types";
import { ItemCard } from "./item-card";
import { ItemsTable } from "./items-table";

type CatalogueViewProps = {
  items: ItemWithImages[];
  itemCount: number;
};

export function CatalogueView({ items, itemCount }: CatalogueViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const exportHref = searchParams.toString()
    ? `/api/catalogue/export?${searchParams.toString()}`
    : "/api/catalogue/export";
  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIds.includes(item.id)),
    [items, selectedItemIds],
  );

  function toggleSelection(itemId: string) {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((existingId) => existingId !== itemId)
        : current.concat(itemId),
    );
  }

  function clearSelection() {
    setSelectedItemIds([]);
  }

  function goToBulkInterest() {
    const params = new URLSearchParams();

    for (const itemId of selectedItemIds) {
      params.append("itemId", itemId);
    }

    router.push(`/show-interest?${params.toString()}`);
  }

  const iconButtonClassName =
    "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-secondary)] text-stone-900 transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]";
  const activeIconButtonClassName =
    "inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--primary)] text-white transition";

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-1">
        <div>
          <h2 className="display-title text-2xl font-semibold text-stone-900">
            Active catalogue
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {itemCount} item{itemCount === 1 ? "" : "s"} matching the
            current view.
          </p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Open any item to show interest in a single listing, or select multiple items here and submit one combined enquiry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedItemIds.length > 0 ? (
            <>
              <button className="button" onClick={goToBulkInterest} type="button">
                Show interest for {selectedItemIds.length} item{selectedItemIds.length === 1 ? "" : "s"}
              </button>
              <button className="button-ghost" onClick={clearSelection} type="button">
                Clear selection
              </button>
            </>
          ) : null}
          <Link aria-label="Export catalogue CSV" className={iconButtonClassName} href={exportHref} title="Export CSV">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path
                d="M12 3v11m0 0 4-4m-4 4-4-4M5 18h14"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </Link>
          <button
            aria-label="Grid view"
            onClick={() => setViewMode("grid")}
            title="Grid view"
            className={`${
              viewMode === "grid"
                ? activeIconButtonClassName
                : iconButtonClassName
            }`}
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path
                d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
          <button
            aria-label="Table view"
            onClick={() => setViewMode("table")}
            title="Table view"
            className={`${
              viewMode === "table"
                ? activeIconButtonClassName
                : iconButtonClassName
            }`}
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="display-title text-3xl font-semibold text-stone-900">
            No items match those filters.
          </p>
          <p className="mt-3 text-[color:var(--muted)]">
            Clear the search or select a different status or category.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="space-y-3">
          {selectedItems.length > 0 ? (
            <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 md:p-5">
              <p className="text-sm font-medium text-stone-900">
                Selected: {selectedItems.map((item) => item.title).join(", ")}
              </p>
              <button className="button-secondary" onClick={goToBulkInterest} type="button">
                Continue with selected items
              </button>
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item, index) => (
            <div
              key={item.id}
              className="fade-up"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <ItemCard
                isSelected={selectedItemIds.includes(item.id)}
                item={item}
                onToggleSelection={toggleSelection}
              />
            </div>
            ))}
          </div>
        </div>
      ) : (
        <ItemsTable
          items={items}
          onToggleSelection={toggleSelection}
          selectedItemIds={selectedItemIds}
        />
      )}
    </>
  );
}
