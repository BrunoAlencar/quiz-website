import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/server/auth";
import { validateQuizInput } from "@/lib/validation";
import { getPool } from "../../../../../../db/pool";
import { getQuiz, updateQuiz } from "@/server/repositories/quizzes";

function authed(): boolean {
  return verifySession(cookies().get("admin_session")?.value);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const quiz = await getQuiz(getPool(), params.id);
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quiz);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const check = validateQuizInput(body);
  if (!check.valid) return NextResponse.json({ errors: check.errors }, { status: 400 });
  await updateQuiz(getPool(), params.id, body);
  return NextResponse.json({ ok: true });
}
