import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

const LINK =
  "underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600";

export default function CommercialLinks({
  className = "mt-6 text-sm text-ink/60",
}: {
  className?: string;
}) {
  return (
    <p className={className}>
      Sold by {OPERATOR.legalName}. Questions:{" "}
      <a className={LINK} href={`mailto:${OPERATOR.email}`}>
        {OPERATOR.email}
      </a>
      {" · "}
      <Link className={LINK} href="/pricing">
        Pricing &amp; cancellation
      </Link>
      {" · "}
      <Link className={LINK} href="/demo">
        Dashboard preview
      </Link>
    </p>
  );
}
