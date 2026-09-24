import pg from "pg";
type DB = pg.Pool | pg.PoolClient;

export async function createPlayer(db: DB, gameId: string, nickname: string) {
  const res = await db.query(
    "INSERT INTO players (game_id, nickname) VALUES ($1, $2) RETURNING id, nickname",
    [gameId, nickname]
  );
  return res.rows[0] as { id: string; nickname: string };
}

export async function listPlayers(db: DB, gameId: string) {
  const res = await db.query(
    "SELECT id, nickname FROM players WHERE game_id = $1 ORDER BY joined_at ASC",
    [gameId]
  );
  return res.rows as { id: string; nickname: string }[];
}

export async function setPlayerScore(db: DB, playerId: string, score: number) {
  await db.query("UPDATE players SET score = $1 WHERE id = $2", [score, playerId]);
}
