import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/server/auth";
import { validateQuizInput } from "@/lib/validation";
import { getPool } from "../../../../../db/pool";
import { listQuizzes, createQuiz } from "@/server/repositories/quizzes";

function authed(): boolean {
  return verifySession(cookies().get("admin_session")?.value);
}

export async function GET() {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listQuizzes(getPool()));
}

export async function POST(req: Request) {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const check = validateQuizInput(body);
  if (!check.valid) return NextResponse.json({ errors: check.errors }, { status: 400 });
  const id = await createQuiz(getPool(), body);
  return NextResponse.json({ id }, { status: 201 });
}
