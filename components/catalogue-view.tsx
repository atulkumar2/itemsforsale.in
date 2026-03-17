"use client";

import { useState } from "react";
import type { ItemWithImages } from "@/lib/types";
import { ItemCard } from "./item-card";
import { ItemsTable } from "./items-table";

type CatalogueViewProps = {
  items: ItemWithImages[];
  itemCount: number;
};

export function CatalogueView({ items, itemCount }: CatalogueViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-1">
        <div>
          <h2 className="display-title text-3xl font-semibold text-stone-900">
            Active catalogue
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {itemCount} item{itemCount === 1 ? "" : "s"} matching the
            current view.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === "grid"
                ? "bg-[color:var(--primary)] text-white"
                : "bg-[color:var(--bg-secondary)] text-stone-900 hover:bg-[color:var(--line)]"
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === "table"
                ? "bg-[color:var(--primary)] text-white"
                : "bg-[color:var(--bg-secondary)] text-stone-900 hover:bg-[color:var(--line)]"
            }`}
          >
            Table
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="fade-up"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <ItemCard item={item} />
            </div>
          ))}
        </div>
      ) : (
        <ItemsTable items={items} />
      )}
    </>
  );
}
