import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { createQuiz, getQuiz, listQuizzes, updateQuiz, getQuizForPlay } from "@/server/repositories/quizzes";
import { createGame, getGameByCode, setGameStatus, finalizeGame } from "@/server/repositories/games";
import { createPlayer, listPlayers, setPlayerScore } from "@/server/repositories/players";
import { recordAnswer } from "@/server/repositories/answers";

const url = process.env.DATABASE_URL_TEST;
const pool = new pg.Pool({ connectionString: url });

const sampleInput = {
  title: "Geo",
  description: "geography",
  questions: [
    {
      text: "Capital of France?",
      time_limit_seconds: 20,
      points_base: 1000,
      options: [
        { text: "Paris", is_correct: true },
        { text: "London", is_correct: false },
        { text: "Rome", is_correct: false },
        { text: "Berlin", is_correct: false },
      ],
    },
  ],
};

beforeAll(() => {
  if (!url) throw new Error("DATABASE_URL_TEST must be set to run repository tests");
});
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  await pool.query("TRUNCATE answers, players, games, options, questions, quizzes CASCADE");
});

describe("quizzes repository", () => {
  it("creates and reads a full quiz", async () => {
    const id = await createQuiz(pool, sampleInput);
    const quiz = await getQuiz(pool, id);
    expect(quiz?.title).toBe("Geo");
    expect(quiz?.questions).toHaveLength(1);
    expect(quiz?.questions[0].options).toHaveLength(4);
    expect(quiz?.questions[0].options.filter((o) => o.is_correct)).toHaveLength(1);
  });

  it("lists quizzes with a question count", async () => {
    await createQuiz(pool, sampleInput);
    const list = await listQuizzes(pool);
    expect(list).toHaveLength(1);
    expect(list[0].question_count).toBe(1);
  });

  it("returns null for a missing quiz", async () => {
    expect(await getQuiz(pool, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("replaces questions on update", async () => {
    const id = await createQuiz(pool, sampleInput);
    await updateQuiz(pool, id, {
      ...sampleInput,
      title: "Geo2",
      questions: [
        { ...sampleInput.questions[0], text: "Capital of Italy?" },
        { ...sampleInput.questions[0], text: "Capital of Spain?" },
      ],
    });
    const quiz = await getQuiz(pool, id);
    expect(quiz?.title).toBe("Geo2");
    expect(quiz?.questions).toHaveLength(2);
    expect(quiz?.questions[0].text).toBe("Capital of Italy?");
  });

  it("returns ordered questions with correctness for play", async () => {
    const id = await createQuiz(pool, sampleInput);
    const qs = await getQuizForPlay(pool, id);
    expect(qs).toHaveLength(1);
    expect(qs[0].options.some((o) => o.is_correct)).toBe(true);
  });
});

describe("games/players/answers repositories", () => {
  it("creates and finds a game by code", async () => {
    const quizId = await createQuiz(pool, sampleInput);
    const game = await createGame(pool, quizId, "ABC234");
    const found = await getGameByCode(pool, "ABC234");
    expect(found?.id).toBe(game.id);
    expect(found?.status).toBe("lobby");
  });

  it("updates game status", async () => {
    const quizId = await createQuiz(pool, sampleInput);
    const game = await createGame(pool, quizId, "ABC235");
    await setGameStatus(pool, game.id, "in_progress");
    const found = await getGameByCode(pool, "ABC235");
    expect(found?.status).toBe("in_progress");
  });

  it("creates and lists players, and updates score", async () => {
    const quizId = await createQuiz(pool, sampleInput);
    const game = await createGame(pool, quizId, "ABC236");
    const p = await createPlayer(pool, game.id, "Alex");
    await setPlayerScore(pool, p.id, 740);
    const players = await listPlayers(pool, game.id);
    expect(players.map((x) => x.nickname)).toContain("Alex");
  });

  it("finalizeGame atomically persists scores and marks the game ended", async () => {
    const quizId = await createQuiz(pool, sampleInput);
    const game = await createGame(pool, quizId, "ABC238");
    const p1 = await createPlayer(pool, game.id, "Alex");
    const p2 = await createPlayer(pool, game.id, "Sam");
    const endedAt = new Date();

    await finalizeGame(
      pool,
      game.id,
      [{ playerId: p1.id, score: 900 }, { playerId: p2.id, score: 400 }],
      endedAt
    );

    const found = await getGameByCode(pool, "ABC238");
    expect(found?.status).toBe("ended");

    const scores = await pool.query("SELECT id, score FROM players WHERE game_id = $1", [game.id]);
    const scoreById = new Map(scores.rows.map((r) => [r.id, r.score]));
    expect(scoreById.get(p1.id)).toBe(900);
    expect(scoreById.get(p2.id)).toBe(400);
  });

  it("rolls back finalizeGame entirely if the transaction fails partway through", async () => {
    const quizId = await createQuiz(pool, sampleInput);
    const game = await createGame(pool, quizId, "ABC239");
    const p1 = await createPlayer(pool, game.id, "Alex");

    // An invalid (non-UUID) game id makes the final UPDATE statement fail,
    // after the player score UPDATE already ran earlier in the same
    // transaction. Both must be rolled back.
    await expect(
      finalizeGame(pool, "not-a-uuid", [{ playerId: p1.id, score: 777 }], new Date())
    ).rejects.toThrow();

    const scores = await pool.query("SELECT id, score FROM players WHERE game_id = $1", [game.id]);
    const scoreById = new Map(scores.rows.map((r) => [r.id, r.score]));
    expect(scoreById.get(p1.id)).toBe(0); // score update rolled back
    const found = await getGameByCode(pool, "ABC239");
    expect(found?.status).toBe("lobby"); // status update rolled back
  });

  it("records an answer and enforces one per player/question", async () => {
    const quizId = await createQuiz(pool, sampleInput);
    const quiz = await getQuiz(pool, quizId);
    const q = quiz!.questions[0];
    const correct = q.options.find((o) => o.is_correct)!;
    const game = await createGame(pool, quizId, "ABC237");
    const p = await createPlayer(pool, game.id, "Alex");
    await recordAnswer(pool, {
      gameId: game.id, playerId: p.id, questionId: q.id, optionId: correct.id,
      isCorrect: true, responseMs: 1200, pointsAwarded: 940,
    });
    await expect(
      recordAnswer(pool, {
        gameId: game.id, playerId: p.id, questionId: q.id, optionId: correct.id,
        isCorrect: true, responseMs: 1300, pointsAwarded: 900,
      })
    ).rejects.toThrow();
  });
});
