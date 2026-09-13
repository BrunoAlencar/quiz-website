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
