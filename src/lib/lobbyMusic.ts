let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;

const STEP_SECONDS = 0.2; // one eighth note at 150 bpm
const LOOKAHEAD_SECONDS = 1.2; // generous, so a throttled background tab does not leave gaps
const VOLUME = 0.12;
const FADE_SECONDS = 0.5;

// Four bars of eight steps: C – Am – F – G. Chord tones are [root, third, fifth, octave].
const CHORDS = [
  [523.25, 659.25, 783.99, 1046.5],
  [440.0, 523.25, 659.25, 880.0],
  [349.23, 440.0, 523.25, 698.46],
  [392.0, 493.88, 587.33, 783.99],
];
const BASS = [130.81, 110.0, 87.31, 98.0];
const MELODY_PATTERN = [0, 1, 2, 1, 3, 2, 1, 2];
const BASS_STEPS = [0, 3, 4, 6];

function note(freq: number, at: number, duration: number, type: OscillatorType, volume: number): void {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
  osc.connect(gain).connect(master);
  osc.start(at);
  osc.stop(at + duration + 0.01);
}

function schedule(): void {
  try {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      const bar = Math.floor(step / 8) % CHORDS.length;
      const i = step % 8;
      note(CHORDS[bar][MELODY_PATTERN[i]], nextTime, STEP_SECONDS * 0.9, "triangle", 0.5);
      if (BASS_STEPS.includes(i)) note(BASS[bar], nextTime, STEP_SECONDS * 1.6, "square", 0.35);
      step += 1;
      nextTime += STEP_SECONDS;
    }
  } catch {
    // no audio available
  }
}

/** Looping synthesized lobby tune. Never throws: sound must not break a game. */
export function startLobbyMusic(): void {
  if (timer) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
    nextTime = ctx.currentTime + 0.05;
    step = 0;
    schedule();
    timer = setInterval(schedule, 250);
  } catch {
    // no audio available
  }
}

/** Fades the lobby tune out and stops it. Safe to call when nothing is playing. */
export function stopLobbyMusic(): void {
  if (timer) clearInterval(timer);
  timer = null;
  const fading = master;
  master = null;
  if (!ctx || !fading) return;
  try {
    const now = ctx.currentTime;
    fading.gain.cancelScheduledValues(now);
    fading.gain.setValueAtTime(fading.gain.value, now);
    fading.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    setTimeout(() => fading.disconnect(), FADE_SECONDS * 1000 + 100);
  } catch {
    // no audio available
  }
}
