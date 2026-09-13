import pg from "pg";
type DB = pg.Pool | pg.PoolClient;

export async function createGame(db: DB, quizId: string, joinCode: string) {
  const res = await db.query(
    "INSERT INTO games (quiz_id, join_code) VALUES ($1, $2) RETURNING id, join_code",
    [quizId, joinCode]
  );
  return res.rows[0] as { id: string; join_code: string };
}

export async function getGameByCode(db: DB, code: string) {
  const res = await db.query(
    "SELECT id, quiz_id, status FROM games WHERE join_code = $1",
    [code]
  );
  return res.rowCount ? (res.rows[0] as { id: string; quiz_id: string; status: string }) : null;
}

export async function setGameStatus(db: DB, gameId: string, status: string, endedAt?: Date) {
  await db.query(
    "UPDATE games SET status = $1, ended_at = COALESCE($2, ended_at) WHERE id = $3",
    [status, endedAt ?? null, gameId]
  );
}

/**
 * Atomically persists final player scores and marks the game ended.
 * Runs as a single transaction: either every score update and the status
 * change all land, or none of them do.
 */
export async function finalizeGame(
  db: pg.Pool,
  gameId: string,
  scores: { playerId: string; score: number }[],
  endedAt: Date
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const s of scores) {
      await client.query("UPDATE players SET score = $1 WHERE id = $2", [s.score, s.playerId]);
    }
    await client.query(
      "UPDATE games SET status = $1, ended_at = COALESCE($2, ended_at) WHERE id = $3",
      ["ended", endedAt, gameId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
