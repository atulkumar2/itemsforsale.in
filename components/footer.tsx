import Link from "next/link";
import Image from "next/image";

const sellerAddress =
  "Pioneer Wood winds Apartment, 1st Main, 3rd Cross, BTM 4th Stage, Near Bus Stop, SBI Colony, Devarachiknahalli, Bommanahalli, Bengaluru, Karnataka 560076";
const sellerMapsLink = "https://maps.app.goo.gl/dnveXLxu6jniBJHv6";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[color:var(--line)] bg-[color:var(--bg-secondary)]">
      <div className="shell grid gap-8 py-12 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/icon.svg"
              alt="itemsforsale.in"
              width="32"
              height="32"
              className="h-8 w-8"
            />
            <h3 className="display-title font-semibold text-stone-900">
              itemsforsale.in
            </h3>
          </div>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Household items for sale in Devarachiknahalli, South Bengaluru.
          </p>
        </div>

        <div>
          <p className="eyebrow font-semibold text-stone-900">Quick links</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link
              href="/"
              className="text-[color:var(--muted)] hover:text-stone-900"
            >
              Browse items
            </Link>
            <Link
              href="/contact-seller"
              className="text-[color:var(--muted)] hover:text-stone-900"
            >
              Contact seller
            </Link>
            <Link
              href="/about"
              className="text-[color:var(--muted)] hover:text-stone-900"
            >
              About this site
            </Link>
            <Link
              href="/admin"
              className="text-[color:var(--muted)] hover:text-stone-900"
            >
              Admin
            </Link>
          </div>
        </div>

        <div>
          <p className="eyebrow font-semibold text-stone-900">Seller location</p>
          <p className="mt-3 text-sm text-[color:var(--muted)]">
            {sellerAddress}
          </p>
          <a
            href={sellerMapsLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm text-[color:var(--primary)] hover:underline"
          >
            View on Google Maps →
          </a>
        </div>
      </div>

      <div className="border-t border-[color:var(--line)] py-6 text-center">
        <p className="text-xs text-[color:var(--muted)]">
          © 2026 itemsforsale.in. All rights reserved.
        </p>
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Repository:{" "}
          <a
            href="https://github.com/atulkumar2/itemsforsale.in"
            target="_blank"
            rel="noreferrer"
            className="hover:text-stone-900 hover:underline"
          >
            github.com/atulkumar2/itemsforsale.in
          </a>
        </p>
      </div>
    </footer>
  );
}
