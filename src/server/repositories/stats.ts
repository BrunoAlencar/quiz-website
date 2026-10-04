import pg from "pg";
import type { DashboardOverview, PastGame, QuestionStat, LeaderboardEntry } from "@/types";

type DB = pg.Pool | pg.PoolClient;

// Every query here counts ended games only: abandoned lobbies and games still
// in progress are not part of the history.

export async function getOverview(db: DB): Promise<DashboardOverview> {
  const res = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM games WHERE status = 'ended') AS games_played,
       (SELECT COUNT(*)::int FROM players p
          JOIN games g ON g.id = p.game_id WHERE g.status = 'ended') AS participants,
       (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE a.is_correct) / NULLIF(COUNT(*), 0))::int
          FROM answers a JOIN games g ON g.id = a.game_id WHERE g.status = 'ended') AS accuracy_pct,
       (SELECT q.title FROM games g JOIN quizzes q ON q.id = g.quiz_id
          WHERE g.status = 'ended'
          GROUP BY q.id
          ORDER BY COUNT(*) DESC, MAX(g.ended_at) DESC
          LIMIT 1) AS top_quiz_title`
  );
  return res.rows[0] as DashboardOverview;
}

export async function listPastGames(db: DB, limit = 100): Promise<PastGame[]> {
  const res = await db.query(
    `SELECT g.id, g.quiz_id, q.title AS quiz_title, g.ended_at,
            (SELECT COUNT(*)::int FROM players p WHERE p.game_id = g.id) AS player_count,
            w.nickname AS winner_nickname, w.score AS winner_score
     FROM games g
     JOIN quizzes q ON q.id = g.quiz_id
     LEFT JOIN LATERAL (
       SELECT nickname, score FROM players p
       WHERE p.game_id = g.id
       ORDER BY score DESC, joined_at ASC, id ASC
       LIMIT 1
     ) w ON true
     WHERE g.status = 'ended'
     ORDER BY g.ended_at DESC NULLS LAST, g.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows as PastGame[];
}

export async function getGameRanking(db: DB, gameId: string): Promise<LeaderboardEntry[]> {
  const res = await db.query(
    `SELECT id AS player_id, nickname, score,
            (ROW_NUMBER() OVER (ORDER BY score DESC, joined_at ASC, id ASC))::int AS rank
     FROM players WHERE game_id = $1
     ORDER BY rank`,
    [gameId]
  );
  return res.rows as LeaderboardEntry[];
}

/** Per-question accuracy for a quiz, hardest first; unanswered questions last. */
export async function getQuestionStats(db: DB, quizId: string): Promise<QuestionStat[]> {
  const res = await db.query(
    `SELECT qs.id AS question_id, qs.text, qs.position,
            COUNT(a.id)::int AS answers,
            (COUNT(a.id) FILTER (WHERE a.is_correct))::int AS correct,
            ROUND(100.0 * COUNT(a.id) FILTER (WHERE a.is_correct) / NULLIF(COUNT(a.id), 0))::int AS correct_pct,
            ROUND(AVG(a.response_ms))::int AS avg_response_ms
     FROM questions qs
     LEFT JOIN (
       SELECT a.id, a.question_id, a.is_correct, a.response_ms
       FROM answers a JOIN games g ON g.id = a.game_id
       WHERE g.status = 'ended'
     ) a ON a.question_id = qs.id
     WHERE qs.quiz_id = $1
     GROUP BY qs.id
     ORDER BY correct_pct ASC NULLS LAST, qs.position ASC`,
    [quizId]
  );
  return res.rows as QuestionStat[];
}
