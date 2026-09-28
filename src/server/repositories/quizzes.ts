import pg from "pg";
import type { Quiz, Question, QuizSummary, QuizInput } from "@/types";

type DB = pg.Pool | pg.PoolClient;

export async function createQuiz(db: DB, input: QuizInput): Promise<string> {
  const isPool = typeof (db as pg.Pool).connect === "function" && !("release" in db);
  const client = isPool ? await (db as pg.Pool).connect() : (db as pg.PoolClient);
  try {
    await client.query("BEGIN");
    const quiz = await client.query(
      "INSERT INTO quizzes (title, description) VALUES ($1, $2) RETURNING id",
      [input.title.trim(), input.description ?? null]
    );
    const quizId: string = quiz.rows[0].id;
    await insertQuestions(client, quizId, input);
    await client.query("COMMIT");
    return quizId;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    if (isPool) (client as pg.PoolClient).release();
  }
}

async function insertQuestions(client: pg.PoolClient, quizId: string, input: QuizInput) {
  for (let qi = 0; qi < input.questions.length; qi++) {
    const q = input.questions[qi];
    const inserted = await client.query(
      `INSERT INTO questions (quiz_id, text, position, time_limit_seconds, points_base)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [quizId, q.text.trim(), qi, q.time_limit_seconds, q.points_base]
    );
    const questionId: string = inserted.rows[0].id;
    for (let oi = 0; oi < q.options.length; oi++) {
      const o = q.options[oi];
      await client.query(
        `INSERT INTO options (question_id, text, is_correct, position) VALUES ($1, $2, $3, $4)`,
        [questionId, o.text.trim(), o.is_correct, oi]
      );
    }
  }
}

export async function listQuizzes(db: DB): Promise<QuizSummary[]> {
  const res = await db.query(
    `SELECT q.id, q.title, q.description, q.created_at,
            COUNT(qs.id)::int AS question_count
     FROM quizzes q
     LEFT JOIN questions qs ON qs.quiz_id = q.id
     GROUP BY q.id
     ORDER BY q.created_at DESC`
  );
  return res.rows as QuizSummary[];
}

export async function getQuiz(db: DB, id: string): Promise<Quiz | null> {
  const quizRes = await db.query(
    "SELECT id, title, description, created_at FROM quizzes WHERE id = $1",
    [id]
  );
  if (quizRes.rowCount === 0) return null;
  const questions = await loadQuestions(db, id);
  return { ...quizRes.rows[0], questions } as Quiz;
}

async function loadQuestions(db: DB, quizId: string): Promise<Question[]> {
  const qRes = await db.query(
    `SELECT id, quiz_id, text, position, time_limit_seconds, points_base
     FROM questions WHERE quiz_id = $1 ORDER BY position ASC`,
    [quizId]
  );
  const questions: Question[] = [];
  for (const row of qRes.rows) {
    const oRes = await db.query(
      `SELECT id, question_id, text, is_correct, position
       FROM options WHERE question_id = $1 ORDER BY position ASC`,
      [row.id]
    );
    questions.push({ ...row, options: oRes.rows });
  }
  return questions;
}

export async function getQuizForPlay(db: DB, quizId: string): Promise<Question[]> {
  return loadQuestions(db, quizId);
}

export async function deleteQuiz(db: DB, id: string): Promise<boolean> {
  const isPool = typeof (db as pg.Pool).connect === "function" && !("release" in db);
  const client = isPool ? await (db as pg.Pool).connect() : (db as pg.PoolClient);
  try {
    await client.query("BEGIN");
    // games -> quizzes uses ON DELETE RESTRICT, so remove games first
    // (players and answers cascade off games automatically). questions and
    // options then cascade off the quiz itself.
    await client.query("DELETE FROM games WHERE quiz_id = $1", [id]);
    const res = await client.query("DELETE FROM quizzes WHERE id = $1", [id]);
    await client.query("COMMIT");
    return (res.rowCount ?? 0) > 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    if (isPool) (client as pg.PoolClient).release();
  }
}

export async function updateQuiz(db: DB, id: string, input: QuizInput): Promise<void> {
  const isPool = typeof (db as pg.Pool).connect === "function" && !("release" in db);
  const client = isPool ? await (db as pg.Pool).connect() : (db as pg.PoolClient);
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE quizzes SET title = $1, description = $2 WHERE id = $3",
      [input.title.trim(), input.description ?? null, id]
    );
    await client.query("DELETE FROM questions WHERE quiz_id = $1", [id]);
    await insertQuestions(client, id, input);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    if (isPool) (client as pg.PoolClient).release();
  }
}
