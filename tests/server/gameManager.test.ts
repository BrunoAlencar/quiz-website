import { describe, it, expect } from "vitest";
import type { Question } from "@/types";
import { GameStore } from "@/server/gameState";
import {
  addPlayer, startQuestion, submitAnswer, allAnswered,
  leaderboard, distribution, isLastQuestion, currentQuestion,
} from "@/server/gameManager";

function makeQuestion(i: number, correctPos: number): Question {
  return {
    id: `q${i}`, quiz_id: "quiz", text: `Q${i}`, position: i,
    time_limit_seconds: 20, points_base: 1000,
    options: [0, 1, 2, 3].map((p) => ({
      id: `q${i}o${p}`, question_id: `q${i}`, text: `opt${p}`,
      is_correct: p === correctPos, position: p,
    })),
  };
}

function makeGame() {
  const store = new GameStore();
  const game = {
    id: "g1", quizId: "quiz", joinCode: "ABC234",
    questions: [makeQuestion(0, 0), makeQuestion(1, 1)],
    players: new Map(), currentIndex: -1, questionStartMs: null,
    answers: new Map(), status: "lobby" as const,
  };
  store.create(game);
  return { store, game };
}

describe("gameManager", () => {
  it("adds players and dedupes nicknames", () => {
    const { game } = makeGame();
    addPlayer(game, "p1", "Alex");
    addPlayer(game, "p2", "Alex");
    const names = [...game.players.values()].map((p) => p.nickname);
    expect(names).toEqual(["Alex", "Alex (2)"]);
  });

  it("starts questions in order", () => {
    const { game } = makeGame();
    const first = startQuestion(game, 1000);
    expect(first.index).toBe(0);
    expect(first.total).toBe(2);
    expect(first.options[0]).not.toHaveProperty("is_correct");
    const second = startQuestion(game, 2000);
    expect(second.index).toBe(1);
  });

  it("scores a correct fast answer and updates leaderboard", () => {
    const { game } = makeGame();
    addPlayer(game, "p1", "Alex");
    startQuestion(game, 1000);
    const res = submitAnswer(game, "p1", "q0o0", 1000); // instant
    expect(res?.is_correct).toBe(true);
    expect(res?.points_awarded).toBe(1000);
    expect(leaderboard(game)[0]).toMatchObject({ player_id: "p1", score: 1000, rank: 1 });
  });

  it("gives 0 for a wrong answer and ignores double-submit", () => {
    const { game } = makeGame();
    addPlayer(game, "p1", "Alex");
    startQuestion(game, 1000);
    const first = submitAnswer(game, "p1", "q0o1", 1000);
    expect(first?.points_awarded).toBe(0);
    const second = submitAnswer(game, "p1", "q0o0", 1000);
    expect(second).toBeNull();
  });

  it("reports allAnswered and distribution", () => {
    const { game } = makeGame();
    addPlayer(game, "p1", "Alex");
    addPlayer(game, "p2", "Sam");
    startQuestion(game, 1000);
    submitAnswer(game, "p1", "q0o0", 1000);
    expect(allAnswered(game)).toBe(false);
    submitAnswer(game, "p2", "q0o1", 1000);
    expect(allAnswered(game)).toBe(true);
    expect(distribution(game)).toMatchObject({ q0o0: 1, q0o1: 1 });
  });

  it("detects the last question", () => {
    const { game } = makeGame();
    startQuestion(game, 1000);
    expect(isLastQuestion(game)).toBe(false);
    startQuestion(game, 2000);
    expect(isLastQuestion(game)).toBe(true);
    expect(currentQuestion(game)?.id).toBe("q1");
  });
});
