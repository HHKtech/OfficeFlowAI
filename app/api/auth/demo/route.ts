import { NextResponse } from "next/server";
import { z } from "zod";
import { createDemoSession, DEMO_SESSION_COOKIE, isDemoAdminEmail, verifyDemoAdminCredentials } from "@/lib/auth/demo";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials." }, { status: 400 });

  const { email, password } = parsed.data;
  if (!isDemoAdminEmail(email)) return NextResponse.json({ error: "Demo account not found." }, { status: 404 });
  if (!verifyDemoAdminCredentials(email, password)) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(DEMO_SESSION_COOKIE, createDemoSession(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return response;
}