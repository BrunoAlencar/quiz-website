import pg from "pg";
type DB = pg.Pool | pg.PoolClient;

export async function recordAnswer(
  db: DB,
  a: {
    gameId: string; playerId: string; questionId: string; optionId: string;
    isCorrect: boolean; responseMs: number; pointsAwarded: number;
  }
) {
  await db.query(
    `INSERT INTO answers
       (game_id, player_id, question_id, option_id, is_correct, response_ms, points_awarded)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [a.gameId, a.playerId, a.questionId, a.optionId, a.isCorrect, a.responseMs, a.pointsAwarded]
  );
}
