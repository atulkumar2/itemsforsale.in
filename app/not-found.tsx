import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell flex min-h-screen items-center justify-center py-20">
      <div className="panel max-w-2xl p-10 text-center">
        <p className="eyebrow mx-auto">Not found</p>
        <h1 className="display-title mt-6 text-5xl font-semibold text-stone-900">
          That item or page does not exist.
        </h1>
        <p className="mt-4 text-[color:var(--muted)]">
          The listing may have been removed or the link may be outdated.
        </p>
        <Link className="button mt-8" href="/">
          Return to home
        </Link>
      </div>
    </div>
  );
}