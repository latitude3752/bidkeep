import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRelayRequest, getActiveNaicsCodes } from "@netacracy/bid-core";

export const dynamic = "force-dynamic";

/** Lets BidHawk's SAM.gov relay learn which NAICS codes this app needs,
 * without giving it any database credentials of its own -- it only ever
 * sees the code list, never queries this app's Supabase project directly. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedRelayRequest(request.headers.get("x-relay-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const codes = (await getActiveNaicsCodes()).map((c) => c.code);
  return NextResponse.json({ codes });
}
