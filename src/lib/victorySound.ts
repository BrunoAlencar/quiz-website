let ctx: AudioContext | null = null;

const VOLUME = 0.15;

// Rising C major arpeggio that lands on a held chord: [frequency, start offset, duration].
const FANFARE: [number, number, number][] = [
  [523.25, 0, 0.16],
  [659.25, 0.14, 0.16],
  [783.99, 0.28, 0.16],
  [1046.5, 0.42, 1.4],
  [783.99, 0.42, 1.4],
  [659.25, 0.42, 1.4],
  [261.63, 0.42, 1.4],
];

/** Short synthesized victory fanfare. Never throws: sound must not break a game. */
export function playVictory(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime + 0.05;
    for (const [freq, offset, duration] of FANFARE) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(VOLUME, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + duration + 0.01);
    }
  } catch {
    // no audio available
  }
}
