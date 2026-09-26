import type { Server } from "socket.io";
import pg from "pg";
import { GameStore, type LiveGame } from "@/server/gameState";
import {
  addPlayer, startQuestion, submitAnswer, allAnswered,
  leaderboard, distribution, isLastQuestion, currentQuestion, tryResolveQuestion,
} from "@/server/gameManager";
import { generateJoinCode } from "@/lib/joinCode";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types";

interface Deps {
  store: GameStore;
  db: pg.Pool;
  getQuizForPlay: (db: pg.Pool, quizId: string) => Promise<LiveGame["questions"]>;
  createGame: (db: pg.Pool, quizId: string, code: string) => Promise<{ id: string; join_code: string }>;
  createPlayer: (db: pg.Pool, gameId: string, nickname: string) => Promise<{ id: string; nickname: string }>;
  recordAnswer: (db: pg.Pool, a: {
    gameId: string; playerId: string; questionId: string; optionId: string;
    isCorrect: boolean; responseMs: number; pointsAwarded: number;
  }) => Promise<void>;
  setPlayerScore: (db: pg.Pool, playerId: string, score: number) => Promise<void>;
  setGameStatus: (db: pg.Pool, gameId: string, status: string, endedAt?: Date) => Promise<void>;
  finalizeGame: (
    db: pg.Pool,
    gameId: string,
    scores: { playerId: string; score: number }[],
    endedAt: Date
  ) => Promise<void>;
  now: () => number;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

export function registerSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  deps: Deps
): void {
  const { store, db, now } = deps;

  function emitAnsweredCount(game: LiveGame) {
    io.to(game.id).emit("game:answered-count", {
      answered: game.answers.size,
      total: game.players.size,
    });
  }

  function clearQuestionTimer(game: LiveGame) {
    if (game.questionTimer) {
      clearTimeout(game.questionTimer);
      game.questionTimer = undefined;
    }
  }

  function scheduleQuestionTimer(game: LiveGame, timeLimitSeconds: number) {
    clearQuestionTimer(game);
    game.questionTimer = setTimeout(() => {
      game.questionTimer = undefined;
      resolveRound(game).catch(() => {
        io.to(game.id).emit("game:error", { message: GENERIC_ERROR });
      });
    }, timeLimitSeconds * 1000);
  }

  async function endGame(game: LiveGame) {
    if (game.status === "ended") return;
    game.status = "ended";
    clearQuestionTimer(game);
    const scores = [...game.players.values()].map((p) => ({ playerId: p.id, score: p.score }));
    await deps.finalizeGame(db, game.id, scores, new Date());
    io.to(game.id).emit("game:over", { leaderboard: leaderboard(game) });
  }

  function revealQuestion(game: LiveGame) {
    const q = currentQuestion(game);
    if (!q) return;
    const correct = q.options.find((o) => o.is_correct)!;
    io.to(game.id).emit("game:question-result", {
      correct_option_id: correct.id,
      distribution: distribution(game),
      leaderboard: leaderboard(game),
    });
  }

  /**
   * The single reveal/advance path for a question, reached via all-answered,
   * timer expiry, or a disconnect completing the round. Idempotent per
   * question via tryResolveQuestion — whichever trigger wins runs this body
   * exactly once.
   *
   * Even on the last question we only reveal here; the game is not ended
   * automatically. This keeps the host on the reveal screen (question text +
   * answer distribution + leaderboard) for the final question too, matching
   * every other round. The host advances to the final results explicitly via
   * `host:next`, which ends the game.
   */
  async function resolveRound(game: LiveGame): Promise<void> {
    clearQuestionTimer(game);
    if (!tryResolveQuestion(game)) return;
    revealQuestion(game);
  }

  io.on("connection", (socket) => {
    socket.on("host:create-game", async ({ quizId }, ack) => {
      try {
        const questions = await deps.getQuizForPlay(db, quizId);
        if (!questions.length) return ack({ error: "Quiz has no questions" });
        // ensure unique code (retry a few times)
        let code = generateJoinCode();
        let row: { id: string; join_code: string } | null = null;
        for (let i = 0; i < 5 && !row; i++) {
          try { row = await deps.createGame(db, quizId, code); }
          catch { code = generateJoinCode(); }
        }
        if (!row) return ack({ error: "Could not create game" });
        const game: LiveGame = {
          id: row.id, quizId, joinCode: row.join_code, questions,
          players: new Map(), currentIndex: -1, questionStartMs: null,
          answers: new Map(), status: "lobby",
        };
        store.create(game);
        ack({ gameId: game.id, joinCode: game.joinCode });
      } catch {
        ack({ error: "Could not create game" });
      }
    });

    socket.on("host:join-room", ({ gameId }) => { socket.join(gameId); });

    socket.on("player:join", async ({ joinCode, nickname }, ack) => {
      const game = store.getByCode(joinCode.toUpperCase());
      if (!game) return ack({ error: "Game not found" });
      if (game.status !== "lobby") return ack({ error: "Game already started" });
      try {
        const row = await deps.createPlayer(db, game.id, nickname.trim() || "Player");
        addPlayer(game, row.id, nickname);
        const stored = game.players.get(row.id)!;
        socket.join(game.id);
        (socket.data as { playerId?: string; gameId?: string }).playerId = row.id;
        (socket.data as { gameId?: string }).gameId = game.id;
        io.to(game.id).emit("lobby:players", {
          players: [...game.players.values()].map((p) => ({ id: p.id, nickname: p.nickname })),
        });
        ack({ playerId: row.id, gameId: game.id, nickname: stored.nickname });
      } catch {
        ack({ error: "Could not join" });
      }
    });

    socket.on("host:start", async ({ gameId }) => {
      try {
        const game = store.get(gameId);
        if (!game || game.status !== "lobby") return;
        game.status = "in_progress";
        await deps.setGameStatus(db, game.id, "in_progress");
        const q = startQuestion(game, now());
        io.to(game.id).emit("game:question", q);
        emitAnsweredCount(game);
        scheduleQuestionTimer(game, q.time_limit_seconds);
      } catch {
        io.to(gameId).emit("game:error", { message: GENERIC_ERROR });
      }
    });

    socket.on("host:next", async ({ gameId }) => {
      try {
        const game = store.get(gameId);
        if (!game || game.status !== "in_progress") return;
        clearQuestionTimer(game);
        if (isLastQuestion(game)) { await endGame(game); return; }
        const q = startQuestion(game, now());
        io.to(game.id).emit("game:question", q);
        emitAnsweredCount(game);
        scheduleQuestionTimer(game, q.time_limit_seconds);
      } catch {
        io.to(gameId).emit("game:error", { message: GENERIC_ERROR });
      }
    });

    socket.on("player:submit", async ({ gameId, playerId, optionId }) => {
      try {
        const game = store.get(gameId);
        if (!game) return;
        const q = currentQuestion(game);
        const submittedAt = now();
        const result = submitAnswer(game, playerId, optionId, submittedAt);
        if (!result || !q) return;
        // Capture round completion synchronously (before any await) so exactly one
        // submission triggers the reveal/advance — avoids a double-fire race.
        const completedRound = allAnswered(game);
        await deps.recordAnswer(db, {
          gameId: game.id, playerId, questionId: q.id, optionId,
          isCorrect: result.is_correct,
          responseMs: submittedAt - (game.questionStartMs ?? submittedAt),
          pointsAwarded: result.points_awarded,
        });
        socket.emit("player:result", result);
        emitAnsweredCount(game);
        if (completedRound) {
          await resolveRound(game);
        }
      } catch {
        io.to(gameId).emit("game:error", { message: GENERIC_ERROR });
      }
    });

    socket.on("player:resync", ({ gameId, playerId }) => {
      const game = store.get(gameId);
      if (!game) return;
      socket.join(game.id);
      if (game.status === "in_progress") {
        const q = currentQuestion(game);
        if (q && game.questionStartMs !== null) {
          const elapsed = now() - game.questionStartMs;
          const remaining = Math.max(0, q.time_limit_seconds * 1000 - elapsed);
          socket.emit("game:question", {
            id: q.id, text: q.text, position: q.position,
            time_limit_seconds: Math.ceil(remaining / 1000),
            index: game.currentIndex, total: game.questions.length,
            options: q.options.slice().sort((a, b) => a.position - b.position)
              .map((o) => ({ id: o.id, text: o.text, position: o.position })),
          });
        }
      } else if (game.status === "ended") {
        socket.emit("game:over", { leaderboard: leaderboard(game) });
      }
    });

    socket.on("disconnect", () => {
      try {
        const { playerId, gameId } = socket.data as { playerId?: string; gameId?: string };
        if (!playerId || !gameId) return;
        const game = store.get(gameId);
        if (!game || !game.players.has(playerId)) return;
        game.players.delete(playerId);
        io.to(game.id).emit("lobby:players", {
          players: [...game.players.values()].map((p) => ({ id: p.id, nickname: p.nickname })),
        });
        emitAnsweredCount(game);
        if (game.status === "in_progress" && currentQuestion(game) && allAnswered(game)) {
          resolveRound(game).catch(() => {
            io.to(game.id).emit("game:error", { message: GENERIC_ERROR });
          });
        }
      } catch {
        // best-effort cleanup; the socket is already gone so there is nowhere to report to
      }
    });
  });
}
