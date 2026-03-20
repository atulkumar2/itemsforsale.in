import Link from "next/link";

import type { LeadWithItem } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type LeadsTableProps = {
  leads: LeadWithItem[];
};

export function LeadsTable({ leads }: LeadsTableProps) {
  if (leads.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No leads submitted yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Buyer</th>
            <th>Item</th>
            <th>Expected</th>
            <th>Bid</th>
            <th>Message</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>
                <div className="font-semibold text-stone-900">{lead.buyerName}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  {lead.phone || lead.email || "No contact detail"}
                </div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  {lead.location || "Location not shared"}
                </div>
              </td>
              <td>
                {lead.itemSlug ? (
                  <Link className="font-semibold text-stone-900 underline decoration-[color:var(--line)]" href={`/items/${lead.itemSlug}`}>
                    {lead.itemTitle}
                  </Link>
                ) : (
                  <span>{lead.itemTitle}</span>
                )}
              </td>
              <td>{formatCurrency(lead.itemExpectedPrice)}</td>
              <td>{formatCurrency(lead.bidPrice)}</td>
              <td className="max-w-xs text-sm text-[color:var(--muted)]">
                {lead.message || "No message"}
              </td>
              <td>{formatDateTime(lead.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
