import { NextResponse } from "next/server";
import { verifyAdminPassword, signSession } from "@/server/auth";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_session", signSession(), {
    httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production",
  });
  return res;
}
