import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { createQuiz, getQuiz, listQuizzes, updateQuiz, getQuizForPlay } from "@/server/repositories/quizzes";

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
