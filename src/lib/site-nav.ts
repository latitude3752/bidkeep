export const SITE_NAV = [
  { href: "/opportunities", label: "Opportunities" },
  { href: "/grants", label: "Grants" },
  { href: "/set-asides", label: "Set-asides & SCA" },
  { href: "/pricing", label: "Pricing" },
] as const;

export const SIGN_IN_NAV = { href: "/login", label: "Sign in" } as const;

export const FOOTER_SITE_NAV = [
  ...SITE_NAV,
  { href: "/demo", label: "Preview" },
  { href: "/start", label: "Start" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
] as const;
