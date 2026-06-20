import { NextRequest, NextResponse } from "next/server";
import { decryptSession, encryptSession, SESSION_COOKIE } from "@/lib/session";
import { ensureFreshSession, getCurrentUser } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const session = decryptSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ loggedIn: false });

  try {
    const fresh = await ensureFreshSession(session);
    const user = await getCurrentUser(fresh.access_token);
    const res = NextResponse.json({ loggedIn: true, user });
    if (fresh.access_token !== session.access_token) {
      res.cookies.set(SESSION_COOKIE, encryptSession(fresh), {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }
    return res;
  } catch {
    const res = NextResponse.json({ loggedIn: false });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}
