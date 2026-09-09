/** Seat cap is per company, not global -- any number of companies can
 * subscribe, each capped at this many active seats. Raised from the
 * original single-org pilot (one company total, 3 seats) once self-serve
 * checkout needed to support more than one paying customer at a time. */
export const MAX_SEATS_PER_COMPANY = 5;
export const PILOT_MS = 90 * 24 * 60 * 60 * 1000;

export function normalizeCompany(company: string): string {
  return company.trim().toLowerCase();
}

export function assertCanAddSeat(
  activeSeats: Array<{ company: string | null }>,
  incomingCompany: string
): void {
  const incoming = normalizeCompany(incomingCompany);
  if (!incoming) throw new Error("Company is required.");
  const sameCompanySeats = activeSeats.filter(
    (s) => normalizeCompany(s.company ?? "") === incoming
  );
  if (sameCompanySeats.length >= MAX_SEATS_PER_COMPANY) {
    throw new Error(`Seat cap reached (${MAX_SEATS_PER_COMPANY} per company). Revoke one or wait.`);
  }
}
