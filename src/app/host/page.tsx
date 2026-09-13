"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getSocket } from "@/lib/socketClient";
import { Leaderboard } from "@/components/Leaderboard";
import { Countdown } from "@/components/Countdown";
import type { PublicQuestion, LeaderboardEntry } from "@/types";

interface Summary { id: string; title: string; question_count: number; }
type Phase = "pick" | "lobby" | "question" | "result" | "over";

export default function HostPage() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [quizzes, setQuizzes] = useState<Summary[]>([]);
  const [gameId, setGameId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [qr, setQr] = useState("");
  const [players, setPlayers] = useState<{ id: string; nickname: string }[]>([]);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [answered, setAnswered] = useState({ answered: 0, total: 0 });
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  // `window` is undefined during Next.js prerender/SSR of this "use client" page,
  // so origin/host must be captured client-side (in an effect) rather than read
  // directly during render — otherwise `npm run build` fails while prerendering /host.
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/quizzes", { credentials: "include" });
      if (res.ok) setQuizzes(await res.json());
    })();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.on("lobby:players", ({ players }) => setPlayers(players));
    socket.on("game:question", (q) => { setQuestion(q); setDistribution({}); setPhase("question"); });
    socket.on("game:answered-count", (c) => setAnswered(c));
    socket.on("game:question-result", (r) => {
      setDistribution(r.distribution); setBoard(r.leaderboard); setPhase("result");
    });
    socket.on("game:over", ({ leaderboard }) => { setBoard(leaderboard); setPhase("over"); });
    return () => {
      socket.off("lobby:players"); socket.off("game:question");
      socket.off("game:answered-count"); socket.off("game:question-result"); socket.off("game:over");
    };
  }, []);

  async function createGame(quizId: string) {
    const socket = getSocket();
    socket.emit("host:create-game", { quizId }, async (res) => {
      if ("error" in res) { alert(res.error); return; }
      setGameId(res.gameId);
      setJoinCode(res.joinCode);
      socket.emit("host:join-room", { gameId: res.gameId });
      const base = typeof window !== "undefined" ? window.location.origin : origin;
      const url = `${base}/join?code=${res.joinCode}`;
      setQr(await QRCode.toDataURL(url));
      setPhase("lobby");
    });
  }
  function start() { getSocket().emit("host:start", { gameId }); }
  function next() { getSocket().emit("host:next", { gameId }); }

  if (phase === "pick")
    return (
      <main className="container">
        <h1>Host a game</h1>
        <p>Pick a quiz (log in at <a href="/admin">/admin</a> first if the list is empty):</p>
        <ul>
          {quizzes.map((q) => (
            <li key={q.id}>
              <button onClick={() => createGame(q.id)}>{q.title} ({q.question_count} q)</button>
            </li>
          ))}
        </ul>
      </main>
    );

  if (phase === "lobby")
    return (
      <main className="container">
        <h1>Join at {origin.replace(/^https?:\/\//, "")}/join</h1>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: 4 }}>{joinCode}</div>
        {qr && <img src={qr} alt="Join QR" width={220} height={220} />}
        <h2>Players ({players.length})</h2>
        <ul>{players.map((p) => <li key={p.id}>{p.nickname}</li>)}</ul>
        <button onClick={start} disabled={players.length === 0}>Start</button>
      </main>
    );

  if (phase === "question" && question)
    return (
      <main className="container">
        <Countdown seconds={question.time_limit_seconds} keySeed={question.id} />
        <h1>{question.text}</h1>
        <p>{answered.answered} / {answered.total} answered</p>
        <ol>{question.options.map((o) => <li key={o.id}>{o.text}</li>)}</ol>
      </main>
    );

  if (phase === "result" && question)
    return (
      <main className="container">
        <h1>Results</h1>
        <ul>
          {question.options.map((o) => (
            <li key={o.id}>{o.text}: {distribution[o.id] ?? 0}</li>
          ))}
        </ul>
        <h2>Leaderboard</h2>
        <Leaderboard entries={board.slice(0, 5)} />
        <button onClick={next}>Next</button>
      </main>
    );

  if (phase === "over")
    return (
      <main className="container">
        <h1>Final results</h1>
        <Leaderboard entries={board.slice(0, 5)} />
      </main>
    );

  return <main className="container"><p>Loading…</p></main>;
}
