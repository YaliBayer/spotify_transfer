import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthorizeUrl } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getAuthorizeUrl(state));
  res.cookies.set("pt_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
