export const SPEED_FACTOR = 0.5;

export function computeScore(args: {
  isCorrect: boolean;
  responseMs: number;
  timeLimitMs: number;
  pointsBase: number;
}): number {
  const { isCorrect, responseMs, timeLimitMs, pointsBase } = args;
  if (!isCorrect) return 0;
  const clamped = Math.min(Math.max(responseMs, 0), timeLimitMs);
  const factor = 1 - (clamped / timeLimitMs) * SPEED_FACTOR;
  return Math.round(pointsBase * factor);
}
