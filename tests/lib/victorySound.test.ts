import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { installFakeAudio } from "./fakeAudio";

// The module keeps its AudioContext at module level, so each test loads a fresh copy.
async function load() {
  return import("@/lib/victorySound");
}

describe("playVictory", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays every fanfare note to the speakers and stops each one", async () => {
    const contexts = installFakeAudio();
    const { playVictory } = await load();
    playVictory();

    const [ctx] = contexts;
    expect(ctx.oscillators).toHaveLength(7);
    for (const osc of ctx.oscillators) {
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
      const startAt = osc.start.mock.calls[0][0] as number;
      const stopAt = osc.stop.mock.calls[0][0] as number;
      expect(stopAt).toBeGreaterThan(startAt);
    }
    for (const gain of ctx.gains) expect(gain.connectedTo).toBe(ctx.destination);
  });

  it("opens on a rising arpeggio", async () => {
    const contexts = installFakeAudio();
    const { playVictory } = await load();
    playVictory();

    const opening = contexts[0].oscillators.slice(0, 4);
    const freqs = opening.map((o) => o.frequency.value);
    const starts = opening.map((o) => o.start.mock.calls[0][0] as number);
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(new Set(starts).size).toBe(4);
  });

  it("reuses one AudioContext across plays", async () => {
    const contexts = installFakeAudio();
    const { playVictory } = await load();
    playVictory();
    playVictory();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].oscillators).toHaveLength(14);
  });

  it("resumes a suspended context", async () => {
    const contexts = installFakeAudio("suspended");
    const { playVictory } = await load();
    playVictory();
    expect(contexts[0].resume).toHaveBeenCalled();
  });

  it("does not throw when the browser has no AudioContext", async () => {
    vi.stubGlobal("window", {});
    const { playVictory } = await load();
    expect(() => playVictory()).not.toThrow();
  });

  it("does not throw when creating the AudioContext fails", async () => {
    vi.stubGlobal("window", {
      AudioContext: class {
        constructor() {
          throw new Error("blocked");
        }
      },
    });
    const { playVictory } = await load();
    expect(() => playVictory()).not.toThrow();
  });
});
