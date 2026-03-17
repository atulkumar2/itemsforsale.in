import Link from "next/link";

type SiteHeaderProps = {
  compact?: boolean;
};

export function SiteHeader({ compact = false }: SiteHeaderProps) {
  return (
    <header className="shell pt-4 md:pt-6">
      <div className="panel flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <Link href="/" className="display-title text-3xl font-semibold text-stone-900">
            itemsforsale.in
          </Link>
          {!compact ? (
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              One seller. No marketplace clutter. Direct buyer enquiries only.
            </p>
          ) : null}
        </div>

        <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold text-stone-800">
          <Link className="button-ghost" href="/">
            Home
          </Link>
          <Link className="button-ghost" href="/admin">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}