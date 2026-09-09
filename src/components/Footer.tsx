import Link from "next/link";
import { OPERATOR } from "@/lib/operator";
import { FOOTER_SITE_NAV } from "@/lib/site-nav";
import { BID_FAMILY } from "@/lib/bid-family";

export default function Footer() {
  return (
    <footer className="mt-auto bg-navy-950 text-cream/70 print:hidden">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 text-sm md:grid-cols-3">
        <div>
          <p className="font-semibold text-cream">{OPERATOR.productName}</p>
          <p className="mt-2">
            Federal contract tracking for {OPERATOR.vertical}.
          </p>
          <p className="mt-3 text-xs text-cream/50">
            <a
              href={OPERATOR.portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold-400"
            >
              {OPERATOR.legalName}
            </a>
            <br />
            {OPERATOR.addressLine}
            <br />
            <a href={`mailto:${OPERATOR.email}`} className="hover:text-gold-400">
              {OPERATOR.email}
            </a>
            <br />
            {OPERATOR.phone}
          </p>
        </div>
        <div>
          <p className="font-semibold text-cream">Coverage</p>
          <p className="mt-2">SAM.gov solicitations, updated daily.</p>
          <p>Grant awards from USAspending.gov &amp; Grants.gov.</p>
        </div>
        <div>
          <p className="font-semibold text-cream">Site</p>
          <ul className="mt-2 space-y-1">
            {FOOTER_SITE_NAV.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-gold-400">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10 px-6 py-6 text-center text-xs text-cream/50">
        <p>
          Part of the Bid family from {OPERATOR.legalName}:{" "}
          {BID_FAMILY.filter((sibling) => sibling.host !== OPERATOR.siteHost).map((sibling, i, arr) => (
            <span key={sibling.host}>
              <a
                href={sibling.url}
                className="underline decoration-cream/30 underline-offset-2 hover:text-gold-400 hover:decoration-gold-400"
              >
                {sibling.name}
              </a>{" "}
              ({sibling.vertical}){i < arr.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
      </div>
      <div className="border-t border-cream/10 px-6 py-4 text-center text-xs text-cream/40">
        © {new Date().getFullYear()}{" "}
        <a
          href={OPERATOR.portfolioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gold-400"
        >
          {OPERATOR.legalName}
        </a>
        . {OPERATOR.productName} is a product of{" "}
        <a
          href={OPERATOR.portfolioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gold-400"
        >
          {OPERATOR.legalName}
        </a>
        . All rights reserved.
      </div>
    </footer>
  );
}
