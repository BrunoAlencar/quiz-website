import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { installFakeAudio } from "./fakeAudio";

// The module keeps its AudioContext and timer at module level, so each test loads a fresh copy.
async function load() {
  return import("@/lib/lobbyMusic");
}

describe("lobbyMusic", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("schedules the first notes through a master gain wired to the speakers", async () => {
    const contexts = installFakeAudio();
    const { startLobbyMusic } = await load();
    startLobbyMusic();

    const [ctx] = contexts;
    const master = ctx.gains[0];
    expect(master.connectedTo).toBe(ctx.destination);
    expect(master.gain.value).toBeGreaterThan(0);
    expect(ctx.oscillators.length).toBeGreaterThan(0);
    expect(ctx.oscillators[0].frequency.value).toBe(523.25);
    expect(ctx.oscillators[0].start).toHaveBeenCalledWith(0.05);
    for (const gain of ctx.gains.slice(1)) expect(gain.connectedTo).toBe(master);
  });

  it("keeps scheduling notes as playback time advances", async () => {
    const contexts = installFakeAudio();
    const { startLobbyMusic } = await load();
    startLobbyMusic();

    const [ctx] = contexts;
    const initial = ctx.oscillators.length;
    ctx.currentTime = 2;
    vi.advanceTimersByTime(250);
    expect(ctx.oscillators.length).toBeGreaterThan(initial);
  });

  it("does not start a second loop when already playing", async () => {
    const contexts = installFakeAudio();
    const { startLobbyMusic } = await load();
    startLobbyMusic();
    const [ctx] = contexts;
    const initial = ctx.oscillators.length;

    startLobbyMusic();
    expect(contexts).toHaveLength(1);
    expect(ctx.oscillators.length).toBe(initial);
  });

  it("resumes a suspended context", async () => {
    const contexts = installFakeAudio("suspended");
    const { startLobbyMusic } = await load();
    startLobbyMusic();
    expect(contexts[0].resume).toHaveBeenCalled();
  });

  it("fades out, stops scheduling and disconnects on stop", async () => {
    const contexts = installFakeAudio();
    const { startLobbyMusic, stopLobbyMusic } = await load();
    startLobbyMusic();
    const [ctx] = contexts;
    const master = ctx.gains[0];
    ctx.currentTime = 1;

    stopLobbyMusic();
    expect(master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.5);

    const afterStop = ctx.oscillators.length;
    ctx.currentTime = 10;
    vi.advanceTimersByTime(1000);
    expect(ctx.oscillators.length).toBe(afterStop);
    expect(master.disconnect).toHaveBeenCalled();
  });

  it("can be started again after a stop", async () => {
    const contexts = installFakeAudio();
    const { startLobbyMusic, stopLobbyMusic } = await load();
    startLobbyMusic();
    stopLobbyMusic();
    const [ctx] = contexts;
    const afterStop = ctx.oscillators.length;

    startLobbyMusic();
    expect(contexts).toHaveLength(1);
    expect(ctx.oscillators.length).toBeGreaterThan(afterStop);
  });

  it("stop is a no-op when nothing is playing", async () => {
    installFakeAudio();
    const { stopLobbyMusic } = await load();
    expect(() => stopLobbyMusic()).not.toThrow();
  });

  it("does not throw when the browser has no AudioContext", async () => {
    vi.stubGlobal("window", {});
    const { startLobbyMusic, stopLobbyMusic } = await load();
    expect(() => startLobbyMusic()).not.toThrow();
    expect(() => stopLobbyMusic()).not.toThrow();
  });

  it("does not throw when creating the AudioContext fails", async () => {
    vi.stubGlobal("window", {
      AudioContext: class {
        constructor() {
          throw new Error("blocked");
        }
      },
    });
    const { startLobbyMusic } = await load();
    expect(() => startLobbyMusic()).not.toThrow();
  });
});
