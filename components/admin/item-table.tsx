import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import type { ItemWithImages } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type ItemTableProps = {
  items: ItemWithImages[];
  leadCountByItemId?: Record<string, number>;
};

export function ItemTable({ items, leadCountByItemId = {} }: ItemTableProps) {
  if (items.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No items created yet.</p>;
  }

  const actionClassName =
    "inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--primary)] transition hover:text-stone-900";

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Expected price</th>
            <th>Available from</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="font-semibold text-stone-900">{item.title}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">{item.category || "General"}</div>
              </td>
              <td>
                <StatusBadge status={item.status} />
              </td>
              <td>{formatCurrency(item.expectedPrice)}</td>
              <td>{formatDate(item.availableFrom)}</td>
              <td>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link className={actionClassName} href={`/items/${item.slug}`}>
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                    <span>View</span>
                  </Link>
                  <Link className={actionClassName} href={`/admin/leads?itemId=${item.id}`}>
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M4 6.5h16M4 12h16M4 17.5h10"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                    <span>Leads ({leadCountByItemId[item.id] ?? 0})</span>
                  </Link>
                  <Link className={actionClassName} href={`/admin/items/${item.id}/edit`}>
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M4 20h4l10-10-4-4L4 16v4Z"
                        stroke="currentColor"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                      <path
                        d="m12.5 7.5 4 4"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                    <span>Edit</span>
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
