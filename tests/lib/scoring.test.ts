import { describe, it, expect } from "vitest";
import { computeScore, SPEED_FACTOR } from "@/lib/scoring";

describe("computeScore", () => {
  it("returns 0 for an incorrect answer", () => {
    expect(computeScore({ isCorrect: false, responseMs: 100, timeLimitMs: 20000, pointsBase: 1000 })).toBe(0);
  });

  it("awards ~full points for an instant correct answer", () => {
    expect(computeScore({ isCorrect: true, responseMs: 0, timeLimitMs: 20000, pointsBase: 1000 })).toBe(1000);
  });

  it("awards half points at the buzzer with SPEED_FACTOR 0.5", () => {
    expect(computeScore({ isCorrect: true, responseMs: 20000, timeLimitMs: 20000, pointsBase: 1000 })).toBe(500);
  });

  it("scales linearly in between", () => {
    // halfway through, 1 - 0.5*0.5 = 0.75
    expect(computeScore({ isCorrect: true, responseMs: 10000, timeLimitMs: 20000, pointsBase: 1000 })).toBe(750);
  });

  it("clamps responseMs above the limit to the limit", () => {
    expect(computeScore({ isCorrect: true, responseMs: 999999, timeLimitMs: 20000, pointsBase: 1000 })).toBe(500);
  });

  it("exposes SPEED_FACTOR as 0.5", () => {
    expect(SPEED_FACTOR).toBe(0.5);
  });
});
