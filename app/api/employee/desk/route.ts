import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { DESK_COOKIE, isDeskEligible, isDeskOpen } from "@/lib/desk-mode";

export const dynamic = "force-dynamic";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 12,
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const eligible = isDeskEligible(user);
  const active = eligible && (await isDeskOpen());
  return NextResponse.json({ eligible, active });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user || !isDeskEligible(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const response = NextResponse.json({ active: true });
  response.cookies.set(DESK_COOKIE, "1", cookieOptions);
  return response;
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const response = NextResponse.json({ active: false });
  response.cookies.set(DESK_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
