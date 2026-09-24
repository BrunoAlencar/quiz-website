import { describe, it, expect } from "vitest";
import { generateJoinCode, JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from "@/lib/joinCode";

describe("generateJoinCode", () => {
  it("returns a 6-character code", () => {
    expect(generateJoinCode()).toHaveLength(JOIN_CODE_LENGTH);
    expect(JOIN_CODE_LENGTH).toBe(6);
  });

  it("uses only the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      for (const ch of generateJoinCode()) {
        expect(JOIN_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("excludes ambiguous characters 0 O 1 I L", () => {
    for (const bad of ["0", "O", "1", "I", "L"]) {
      expect(JOIN_CODE_ALPHABET).not.toContain(bad);
    }
  });
});
