import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { OPERATOR } from "@/lib/operator";
import { SIGN_IN_NAV, SITE_NAV } from "@/lib/site-nav";

export default function NavBar() {
  return (
    <header className="bg-hero text-hero-text print:hidden">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex flex-col leading-tight">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Bid<span className="text-accent">{BRAND.syllable}</span>
          </Link>
          <a
            href={OPERATOR.portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-hero-text/50 transition-colors hover:text-accent"
          >
            by {OPERATOR.portfolioName}
          </a>
        </div>
        <ul className="hidden gap-8 text-sm font-medium text-hero-text/80 md:flex">
          {SITE_NAV.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="transition-colors hover:text-accent"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={SIGN_IN_NAV.href}
              className="transition-colors hover:text-accent"
            >
              {SIGN_IN_NAV.label}
            </Link>
          </li>
        </ul>
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-md border border-hero-text/30 px-3 py-1.5 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <ul className="absolute right-0 z-50 mt-2 min-w-56 rounded-lg border border-hero-text/10 bg-hero py-2 shadow-lg">
            {SITE_NAV.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block px-4 py-2.5 text-sm text-hero-text/90 hover:bg-navy-800 hover:text-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={SIGN_IN_NAV.href}
                className="block px-4 py-2.5 text-sm text-hero-text/90 hover:bg-navy-800 hover:text-accent"
              >
                {SIGN_IN_NAV.label}
              </Link>
            </li>
          </ul>
        </details>
      </nav>
    </header>
  );
}
