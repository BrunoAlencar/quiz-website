import { computeScore } from "@/lib/scoring";
import type { LiveGame } from "@/server/gameState";
import type { PublicQuestion, LeaderboardEntry, PlayerResult, Question } from "@/types";

export function addPlayer(game: LiveGame, id: string, nickname: string): void {
  const existing = [...game.players.values()].map((p) => p.nickname);
  let name = nickname.trim() || "Player";
  if (existing.includes(name)) {
    let n = 2;
    while (existing.includes(`${name} (${n})`)) n++;
    name = `${name} (${n})`;
  }
  game.players.set(id, { id, nickname: name, score: 0 });
}

export function currentQuestion(game: LiveGame): Question | null {
  return game.questions[game.currentIndex] ?? null;
}

export function startQuestion(game: LiveGame, now: number): PublicQuestion {
  const nextIndex = game.currentIndex + 1;
  if (nextIndex >= game.questions.length) {
    throw new Error("startQuestion called with no remaining questions");
  }
  game.currentIndex = nextIndex;
  game.questionStartMs = now;
  game.answers = new Map();
  const q = game.questions[game.currentIndex];
  return {
    id: q.id,
    text: q.text,
    position: q.position,
    time_limit_seconds: q.time_limit_seconds,
    index: game.currentIndex,
    total: game.questions.length,
    options: q.options
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, text: o.text, position: o.position })),
  };
}

export function submitAnswer(
  game: LiveGame,
  playerId: string,
  optionId: string,
  now: number
): PlayerResult | null {
  const q = currentQuestion(game);
  if (!q || game.questionStartMs === null) return null;
  if (!game.players.has(playerId)) return null;
  if (game.answers.has(playerId)) return null;

  const option = q.options.find((o) => o.id === optionId);
  if (!option) return null;

  const isCorrect = option.is_correct;
  const responseMs = now - game.questionStartMs;
  const points = computeScore({
    isCorrect,
    responseMs,
    timeLimitMs: q.time_limit_seconds * 1000,
    pointsBase: q.points_base,
  });
  game.answers.set(playerId, { optionId, isCorrect, points });
  const player = game.players.get(playerId)!;
  player.score += points;

  const board = leaderboard(game);
  const rank = board.find((e) => e.player_id === playerId)!.rank;
  const correct = q.options.find((o) => o.is_correct)!;
  return {
    is_correct: isCorrect,
    points_awarded: points,
    score: player.score,
    rank,
    correct_option_id: correct.id,
  };
}

export function allAnswered(game: LiveGame): boolean {
  return game.players.size > 0 && game.answers.size >= game.players.size;
}

export function distribution(game: LiveGame): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const a of game.answers.values()) {
    dist[a.optionId] = (dist[a.optionId] ?? 0) + 1;
  }
  return dist;
}

export function leaderboard(game: LiveGame): LeaderboardEntry[] {
  const entries = [...game.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ player_id: p.id, nickname: p.nickname, score: p.score, rank: i + 1 }));
  return entries;
}

export function isLastQuestion(game: LiveGame): boolean {
  return game.currentIndex >= game.questions.length - 1;
}
