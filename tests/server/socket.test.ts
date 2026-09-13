import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { Server as IOServer } from "socket.io";
import { io as ioClient, type Socket } from "socket.io-client";
import pg from "pg";
import { GameStore } from "@/server/gameState";
import { registerSocketHandlers } from "@/server/socket";
import { createQuiz } from "@/server/repositories/quizzes";
import { getQuizForPlay } from "@/server/repositories/quizzes";
import { createGame } from "@/server/repositories/games";
import { createPlayer } from "@/server/repositories/players";
import { recordAnswer } from "@/server/repositories/answers";
import { setPlayerScore } from "@/server/repositories/players";
import { setGameStatus } from "@/server/repositories/games";

const url = process.env.DATABASE_URL_TEST;
const pool = new pg.Pool({ connectionString: url });

const sampleInput = {
  title: "Geo",
  questions: [
    {
      text: "Capital of France?", time_limit_seconds: 20, points_base: 1000,
      options: [
        { text: "Paris", is_correct: true }, { text: "London", is_correct: false },
        { text: "Rome", is_correct: false }, { text: "Berlin", is_correct: false },
      ],
    },
  ],
};

let httpServer: HttpServer;
let io: IOServer;
let port: number;
let now = 0;

beforeAll(async () => {
  if (!url) throw new Error("DATABASE_URL_TEST must be set");
  httpServer = createServer();
  io = new IOServer(httpServer);
  registerSocketHandlers(io, {
    store: new GameStore(), db: pool,
    getQuizForPlay, createGame, createPlayer, recordAnswer, setPlayerScore, setGameStatus,
    now: () => now,
  });
  await new Promise<void>((r) => httpServer.listen(() => r()));
  port = (httpServer.address() as any).port;
});

afterAll(async () => {
  io.close(); httpServer.close(); await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE answers, players, games, options, questions, quizzes CASCADE");
  now = 0;
});

function connect(): Socket {
  return ioClient(`http://localhost:${port}`, { transports: ["websocket"], forceNew: true });
}
function emitAck<T>(s: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((res) => s.emit(event, payload, res));
}
function once<T>(s: Socket, event: string): Promise<T> {
  return new Promise((res) => s.once(event, res));
}

describe("socket flow", () => {
  it("runs a full single-question game", async () => {
    const quizId = await createQuiz(pool, sampleInput);

    const host = connect();
    await once(host, "connect");
    const created = await emitAck<{ gameId: string; joinCode: string }>(
      host, "host:create-game", { quizId }
    );
    expect(created.joinCode).toHaveLength(6);
    host.emit("host:join-room", { gameId: created.gameId });

    const player = connect();
    await once(player, "connect");
    const lobbyPromise = once<{ players: { nickname: string }[] }>(host, "lobby:players");
    const joined = await emitAck<{ playerId: string; gameId: string; nickname: string }>(
      player, "player:join", { joinCode: created.joinCode, nickname: "Alex" }
    );
    expect(joined.nickname).toBe("Alex");
    const lobby = await lobbyPromise;
    expect(lobby.players.map((p) => p.nickname)).toContain("Alex");

    const questionPromise = once<{ id: string; options: { id: string }[] }>(player, "game:question");
    host.emit("host:start", { gameId: created.gameId });
    const question = await questionPromise;
    expect(question.options).toHaveLength(4);

    now = 2000; // 2s to answer
    const resultPromise = once<{ is_correct: boolean; points_awarded: number }>(player, "player:result");
    const overPromise = once<{ leaderboard: { nickname: string; score: number }[] }>(host, "game:over");
    // pick the correct option by matching text via the public question is not possible (no is_correct);
    // the server knows correctness. Submit the first option; then assert result shape.
    player.emit("player:submit", {
      gameId: created.gameId, playerId: joined.playerId, optionId: question.options[0].id,
    });
    const result = await resultPromise;
    expect(typeof result.points_awarded).toBe("number");

    // last question -> game over after all answered
    const over = await overPromise;
    expect(over.leaderboard[0].nickname).toBe("Alex");

    host.close(); player.close();
  });

  it("fires game:over exactly once when two players submit near-simultaneously", async () => {
    const quizId = await createQuiz(pool, sampleInput);

    const host = connect();
    await once(host, "connect");
    const created = await emitAck<{ gameId: string; joinCode: string }>(
      host, "host:create-game", { quizId }
    );
    host.emit("host:join-room", { gameId: created.gameId });

    const overEvents: unknown[] = [];
    host.on("game:over", (payload) => { overEvents.push(payload); });

    const playerA = connect();
    const playerB = connect();
    await Promise.all([once(playerA, "connect"), once(playerB, "connect")]);

    const joinedA = await emitAck<{ playerId: string; gameId: string; nickname: string }>(
      playerA, "player:join", { joinCode: created.joinCode, nickname: "Alex" }
    );
    const joinedB = await emitAck<{ playerId: string; gameId: string; nickname: string }>(
      playerB, "player:join", { joinCode: created.joinCode, nickname: "Sam" }
    );

    const questionPromiseA = once<{ id: string; options: { id: string }[] }>(playerA, "game:question");
    const questionPromiseB = once<{ id: string; options: { id: string }[] }>(playerB, "game:question");
    host.emit("host:start", { gameId: created.gameId });
    const [questionA, questionB] = await Promise.all([questionPromiseA, questionPromiseB]);

    now = 2000; // 2s to answer

    const resultPromiseA = once<{ is_correct: boolean }>(playerA, "player:result");
    const resultPromiseB = once<{ is_correct: boolean }>(playerB, "player:result");
    // Registered before either submit fires, so we can't miss the event by
    // attaching the listener too late.
    const firstOverPromise = once(host, "game:over");

    // Emit both submissions back-to-back without awaiting between them, so the
    // synchronous portions of both handlers race before either await resolves.
    playerA.emit("player:submit", {
      gameId: created.gameId, playerId: joinedA.playerId, optionId: questionA.options[0].id,
    });
    playerB.emit("player:submit", {
      gameId: created.gameId, playerId: joinedB.playerId, optionId: questionB.options[0].id,
    });

    await Promise.all([resultPromiseA, resultPromiseB]);

    // Wait for the first game:over, then give a real-time window for a
    // potential second (buggy, duplicate) emission to arrive.
    await firstOverPromise;
    await new Promise((r) => setTimeout(r, 150));

    expect(overEvents.length).toBe(1);

    host.close(); playerA.close(); playerB.close();
  });

  it("rejects joining an unknown code", async () => {
    const player = connect();
    await once(player, "connect");
    const res = await emitAck<{ error?: string }>(
      player, "player:join", { joinCode: "ZZZZZZ", nickname: "Alex" }
    );
    expect(res.error).toBeTruthy();
    player.close();
  });
});
