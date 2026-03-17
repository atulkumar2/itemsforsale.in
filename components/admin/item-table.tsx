import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import type { ItemWithImages } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type ItemTableProps = {
  items: ItemWithImages[];
};

export function ItemTable({ items }: ItemTableProps) {
  if (items.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No items created yet.</p>;
  }

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
                <div className="flex flex-wrap gap-3">
                  <Link className="button-ghost" href={`/items/${item.slug}`}>
                    View
                  </Link>
                  <Link className="button-secondary" href={`/admin/items/${item.id}/edit`}>
                    Edit
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