import { NextRequest, NextResponse } from "next/server";
import { accessDecision } from "@netacracy/bid-core";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { getSeatById } from "@/lib/subscriber-seats";
import { parseSubscriberSessionToken, SUBSCRIBER_COOKIE } from "@/lib/subscriber-session";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json)$).*)",
  ],
};

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // A literal backslash anywhere in the path crashes Next's route resolution
  // (it tries to require a compiled page module named after the raw,
  // undecoded segment) instead of falling through to a normal 404. Scanners
  // probe well-known routes with a trailing backslash routinely; short-circuit
  // to a clean 404 here before Next's router ever sees it.
  if (pathname.includes("\\") || request.nextUrl.href.includes("%5C") || request.nextUrl.href.includes("%5c")) {
    return new NextResponse(null, { status: 404 });
  }

  const decision = accessDecision(pathname);

  if (decision === "public") {
    return NextResponse.next();
  }

  if (decision === "founder") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!verifySessionToken(token)) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SUBSCRIBER_COOKIE)?.value;
  const session = parseSubscriberSessionToken(token);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const seat = await getSeatById(session.seatId);
  if (!seat || new Date(seat.active_until).getTime() <= Date.now()) {
    const expiredUrl = new URL("/login", request.url);
    expiredUrl.searchParams.set("error", "expired");
    const response = NextResponse.redirect(expiredUrl);
    response.cookies.delete(SUBSCRIBER_COOKIE);
    return response;
  }

  return NextResponse.next();
}
