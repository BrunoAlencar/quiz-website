import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { createQuiz, getQuizForPlay } from "@/server/repositories/quizzes";
import { createGame, finalizeGame } from "@/server/repositories/games";
import { createPlayer } from "@/server/repositories/players";
import { recordAnswer } from "@/server/repositories/answers";
import {
  getOverview, listPastGames, getGameRanking, getQuestionStats,
} from "@/server/repositories/stats";

const url = process.env.DATABASE_URL_TEST;
const pool = new pg.Pool({ connectionString: url });

const question = (text: string) => ({
  text,
  time_limit_seconds: 20,
  points_base: 1000,
  options: [
    { text: "Right", is_correct: true },
    { text: "Wrong", is_correct: false },
    { text: "Other", is_correct: false },
    { text: "Another", is_correct: false },
  ],
});
const quizInput = (title: string) => ({
  title,
  questions: [question("Q1"), question("Q2"), question("Q3")],
});

/** true = answered correctly, false = answered wrong, null = did not answer. */
type Outcome = boolean | null;
interface SeedPlayer { nickname: string; score: number; outcomes: Outcome[]; }

/** Plays a game; leaves it unfinished (status 'lobby') when endedAt is null. */
async function playGame(quizId: string, code: string, players: SeedPlayer[], endedAt: Date | null) {
  const questions = await getQuizForPlay(pool, quizId);
  const game = await createGame(pool, quizId, code);
  const scores: { playerId: string; score: number }[] = [];
  for (const p of players) {
    const created = await createPlayer(pool, game.id, p.nickname);
    scores.push({ playerId: created.id, score: p.score });
    for (let i = 0; i < p.outcomes.length; i++) {
      const outcome = p.outcomes[i];
      if (outcome === null) continue;
      const q = questions[i];
      const option = q.options.find((o) => o.is_correct === outcome)!;
      await recordAnswer(pool, {
        gameId: game.id, playerId: created.id, questionId: q.id, optionId: option.id,
        isCorrect: outcome, responseMs: outcome ? 2000 : 4000, pointsAwarded: outcome ? 900 : 0,
      });
    }
  }
  if (endedAt) await finalizeGame(pool, game.id, scores, endedAt);
  return game.id;
}

async function seedHistory() {
  const quizA = await createQuiz(pool, quizInput("Quiz A"));
  const quizB = await createQuiz(pool, quizInput("Quiz B"));
  const g1 = await playGame(quizA, "AAAAAA", [
    { nickname: "Ana", score: 900, outcomes: [true, true, null] },
    { nickname: "Bia", score: 400, outcomes: [true, false, null] },
  ], new Date("2026-01-01T12:00:00Z"));
  const g2 = await playGame(quizA, "BBBBBB", [
    { nickname: "Caio", score: 500, outcomes: [true, null, null] },
  ], new Date("2026-01-03T12:00:00Z"));
  const g3 = await playGame(quizB, "CCCCCC", [
    { nickname: "Duda", score: 100, outcomes: [false, null, null] },
  ], new Date("2026-01-02T12:00:00Z"));
  const g4 = await playGame(quizB, "DDDDDD", [
    { nickname: "Eva", score: 0, outcomes: [true, true, true] },
  ], null);
  return { quizA, quizB, g1, g2, g3, g4 };
}

beforeAll(() => {
  if (!url) throw new Error("DATABASE_URL_TEST must be set to run repository tests");
});
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  await pool.query("TRUNCATE answers, players, games, options, questions, quizzes CASCADE");
});

describe("stats repository", () => {
  it("returns zeros and nulls on an empty database", async () => {
    expect(await getOverview(pool)).toEqual({
      games_played: 0, participants: 0, accuracy_pct: null, top_quiz_title: null,
    });
    expect(await listPastGames(pool)).toEqual([]);
  });

  it("computes overview totals from ended games only", async () => {
    await seedHistory();
    // 6 answers in ended games, 4 correct -> 67%. Eva's unfinished game is ignored.
    expect(await getOverview(pool)).toEqual({
      games_played: 3, participants: 4, accuracy_pct: 67, top_quiz_title: "Quiz A",
    });
  });

  it("lists ended games newest first with player count and winner", async () => {
    const { g1, g2, g3 } = await seedHistory();
    const games = await listPastGames(pool);
    expect(games.map((g) => g.id)).toEqual([g2, g3, g1]);
    expect(games[2]).toMatchObject({
      quiz_title: "Quiz A", player_count: 2, winner_nickname: "Ana", winner_score: 900,
    });
    expect((await listPastGames(pool, 1)).map((g) => g.id)).toEqual([g2]);
  });

  it("ranks a game's players by score, breaking ties by join order", async () => {
    const { g1, quizA } = await seedHistory();
    expect(await getGameRanking(pool, g1)).toMatchObject([
      { nickname: "Ana", score: 900, rank: 1 },
      { nickname: "Bia", score: 400, rank: 2 },
    ]);

    const tied = await playGame(quizA, "EEEEEE", [
      { nickname: "First", score: 300, outcomes: [] },
      { nickname: "Second", score: 300, outcomes: [] },
    ], new Date("2026-01-04T12:00:00Z"));
    expect((await getGameRanking(pool, tied)).map((e) => e.nickname)).toEqual(["First", "Second"]);

    expect(await getGameRanking(pool, "00000000-0000-0000-0000-000000000000")).toEqual([]);
  });

  it("reports per-question accuracy hardest first, unanswered last", async () => {
    const { quizA, quizB } = await seedHistory();
    const stats = await getQuestionStats(pool, quizA);
    expect(stats.map((s) => s.text)).toEqual(["Q2", "Q1", "Q3"]);
    expect(stats[0]).toMatchObject({ answers: 2, correct: 1, correct_pct: 50, avg_response_ms: 3000 });
    expect(stats[1]).toMatchObject({ answers: 3, correct: 3, correct_pct: 100, avg_response_ms: 2000 });
    expect(stats[2]).toMatchObject({ answers: 0, correct: 0, correct_pct: null, avg_response_ms: null });

    // Eva's answers belong to an unfinished game and must not count.
    const statsB = await getQuestionStats(pool, quizB);
    expect(statsB.find((s) => s.text === "Q1")).toMatchObject({ answers: 1, correct: 0, correct_pct: 0 });
  });
});
