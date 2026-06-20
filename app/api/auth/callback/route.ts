import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/spotify";
import { encryptSession, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const savedState = req.cookies.get("pt_oauth_state")?.value;

  const origin = url.origin;

  if (error) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${origin}/?error=state_mismatch`);
  }

  try {
    const session = await exchangeCodeForToken(code);
    const res = NextResponse.redirect(`${origin}/?connected=1`);
    res.cookies.set(SESSION_COOKIE, encryptSession(session), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    res.cookies.delete("pt_oauth_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(`${origin}/?error=token_exchange_failed`);
  }
}
