import { createServer } from "node:http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { GameStore } from "@/server/gameState";
import { registerSocketHandlers } from "@/server/socket";
import { getPool } from "./db/pool";
import { getQuizForPlay } from "@/server/repositories/quizzes";
import { createGame, setGameStatus, finalizeGame } from "@/server/repositories/games";
import { createPlayer, setPlayerScore } from "@/server/repositories/players";
import { recordAnswer } from "@/server/repositories/answers";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new IOServer<ClientToServerEvents, ServerToClientEvents>(httpServer);
  registerSocketHandlers(io, {
    store: new GameStore(),
    db: getPool(),
    getQuizForPlay, createGame, createPlayer, recordAnswer, setPlayerScore, setGameStatus,
    finalizeGame,
    now: () => Date.now(),
  });
  httpServer.listen(port, () => console.log(`> ready on http://localhost:${port}`));
});
