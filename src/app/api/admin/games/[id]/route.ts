import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/server/auth";
import { getPool } from "../../../../../../db/pool";
import { getGameRanking } from "@/server/repositories/stats";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authed(): boolean {
  return verifySession(cookies().get("admin_session")?.value);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ranking: await getGameRanking(getPool(), params.id) });
}
