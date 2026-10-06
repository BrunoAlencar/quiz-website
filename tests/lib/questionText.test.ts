import { describe, it, expect } from "vitest";
import { parseQuestionText } from "@/lib/questionText";

describe("parseQuestionText", () => {
  it("returns plain text untouched when there is no code", () => {
    expect(parseQuestionText("What is Big O?")).toEqual({ prompt: "What is Big O?", code: null });
  });

  it("extracts a fenced snippet and keeps its line breaks and indentation", () => {
    const text = "What does this print?\n```js\nfor (const x of arr) {\n  log(x);\n}\n```";
    expect(parseQuestionText(text)).toEqual({
      prompt: "What does this print?",
      code: "for (const x of arr) {\n  log(x);\n}",
    });
  });

  it("accepts a fence without a language tag", () => {
    expect(parseQuestionText("Time?\n```\nreturn arr[0];\n```")).toEqual({
      prompt: "Time?",
      code: "return arr[0];",
    });
  });

  it("joins prose written before and after the snippet", () => {
    expect(parseQuestionText("Given\n```js\nf(n);\n```\nwhat is the cost?")).toEqual({
      prompt: "Given what is the cost?",
      code: "f(n);",
    });
  });

  it("treats an unclosed fence as plain text", () => {
    const text = "Time?\n```js\nreturn 1;";
    expect(parseQuestionText(text)).toEqual({ prompt: text, code: null });
  });
});
