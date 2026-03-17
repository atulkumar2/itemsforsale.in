"use client";

import Link from "next/link";
import type { ItemWithImages } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

type ItemsTableProps = {
  items: ItemWithImages[];
};

export function ItemsTable({ items }: ItemsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[color:var(--line)]">
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--bg-secondary)] border-b border-[color:var(--line)]">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-stone-900">
              Item
            </th>
            <th className="px-4 py-3 text-left font-semibold text-stone-900">
              Category
            </th>
            <th className="px-4 py-3 text-left font-semibold text-stone-900">
              Price
            </th>
            <th className="px-4 py-3 text-left font-semibold text-stone-900">
              Status
            </th>
            <th className="px-4 py-3 text-left font-semibold text-stone-900">
              Updated
            </th>
            <th className="px-4 py-3 text-left font-semibold text-stone-900">
              Photos
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-[color:var(--line)] hover:bg-[color:var(--bg-secondary)] transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/items/${item.slug}`}
                  className="font-medium text-[color:var(--primary)] hover:underline"
                >
                  {item.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-[color:var(--muted)]">
                {item.category}
              </td>
              <td className="px-4 py-3 font-medium text-stone-900">
                {formatCurrency(item.expectedPrice)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3 text-[color:var(--muted)]">
                {formatDate(item.updatedAt)}
              </td>
              <td className="px-4 py-3 text-[color:var(--muted)]">
                {item.images?.length ?? 0} photo{(item.images?.length ?? 0) !== 1 ? "s" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
