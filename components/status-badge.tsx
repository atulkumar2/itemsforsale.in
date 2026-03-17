import type { ItemStatus } from "@/lib/types";

type StatusBadgeProps = {
  status: ItemStatus;
};

const statusStyles: Record<ItemStatus, string> = {
  available: "bg-[rgba(47,106,69,0.12)] text-[color:var(--success)] border-[rgba(47,106,69,0.18)]",
  reserved: "bg-[rgba(157,108,24,0.12)] text-[color:var(--warning)] border-[rgba(157,108,24,0.18)]",
  sold: "bg-[rgba(143,57,47,0.12)] text-[color:var(--danger)] border-[rgba(143,57,47,0.18)]",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}