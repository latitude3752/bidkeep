import { clientIpFromHeaders } from "@netacracy/bid-core";
import { headers } from "next/headers";

/** See @netacracy/bid-core's clientIpFromHeaders for the trust-boundary
 * reasoning: trusts X-Real-IP/X-Forwarded-For on Vercel, or off Vercel
 * only when a self-hosting operator opts in via TRUST_PROXY_HEADERS=1;
 * otherwise fails closed to "unknown" rather than trusting a spoofable
 * header. */
export async function clientIp(): Promise<string> {
  const headerStore = await headers();
  return clientIpFromHeaders(headerStore);
}
