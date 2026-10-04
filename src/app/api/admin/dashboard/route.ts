import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/server/auth";
import { getPool } from "../../../../../db/pool";
import { getOverview, listPastGames } from "@/server/repositories/stats";

function authed(): boolean {
  return verifySession(cookies().get("admin_session")?.value);
}

export async function GET() {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pool = getPool();
  const [overview, games] = await Promise.all([getOverview(pool), listPastGames(pool)]);
  return NextResponse.json({ overview, games });
}
