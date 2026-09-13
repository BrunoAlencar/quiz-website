import { describe, it, expect } from "vitest";
import { validateQuizInput } from "@/lib/validation";

const validQuestion = {
  text: "Capital of France?",
  time_limit_seconds: 20,
  points_base: 1000,
  options: [
    { text: "Paris", is_correct: true },
    { text: "London", is_correct: false },
    { text: "Rome", is_correct: false },
    { text: "Berlin", is_correct: false },
  ],
};

describe("validateQuizInput", () => {
  it("accepts a well-formed quiz", () => {
    const res = validateQuizInput({ title: "Geo", questions: [validQuestion] });
    expect(res).toEqual({ valid: true, errors: [] });
  });

  it("rejects an empty title", () => {
    const res = validateQuizInput({ title: "  ", questions: [validQuestion] });
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toMatch(/title/i);
  });

  it("rejects a quiz with no questions", () => {
    const res = validateQuizInput({ title: "Geo", questions: [] });
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toMatch(/at least one question/i);
  });

  it("rejects a question without exactly 4 options", () => {
    const q = { ...validQuestion, options: validQuestion.options.slice(0, 3) };
    const res = validateQuizInput({ title: "Geo", questions: [q] });
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toMatch(/exactly 4 options/i);
  });

  it("rejects a question without exactly 1 correct option", () => {
    const q = {
      ...validQuestion,
      options: validQuestion.options.map((o) => ({ ...o, is_correct: false })),
    };
    const res = validateQuizInput({ title: "Geo", questions: [q] });
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toMatch(/exactly 1 correct/i);
  });

  it("rejects a non-object input", () => {
    expect(validateQuizInput(null).valid).toBe(false);
  });

  it("rejects a non-positive time limit", () => {
    const q = { ...validQuestion, time_limit_seconds: 0 };
    const res = validateQuizInput({ title: "Geo", questions: [q] });
    expect(res.valid).toBe(false);
  });
});
