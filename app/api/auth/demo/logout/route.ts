import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/lib/auth/demo";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(DEMO_SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return response;
}