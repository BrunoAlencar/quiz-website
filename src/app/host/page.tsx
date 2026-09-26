"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getSocket } from "@/lib/socketClient";
import { Leaderboard } from "@/components/Leaderboard";
import { Countdown } from "@/components/Countdown";
import { ANSWER_SHAPES } from "@/components/AnswerButton";
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
  const [correctId, setCorrectId] = useState<string>("");
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
    socket.on("game:question", (q) => { setQuestion(q); setDistribution({}); setCorrectId(""); setPhase("question"); });
    socket.on("game:answered-count", (c) => setAnswered(c));
    socket.on("game:question-result", (r) => {
      setDistribution(r.distribution); setBoard(r.leaderboard); setCorrectId(r.correct_option_id); setPhase("result");
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
      setQr(await QRCode.toDataURL(url, { margin: 1, width: 240 }));
      setPhase("lobby");
    });
  }
  function start() { getSocket().emit("host:start", { gameId }); }
  function next() { getSocket().emit("host:next", { gameId }); }

  const brand = (
    <div className="shapes small" aria-hidden="true">
      <i className="s0">▲</i><i className="s1">◆</i><i className="s2">●</i><i className="s3">■</i>
    </div>
  );

  if (phase === "pick")
    return (
      <main className="screen screen--wide">
        <div className="stack">
          {brand}
          <h1>Host a game</h1>
          <p className="tagline">
            Pick a quiz to open a lobby. No quizzes? <a className="link" href="/admin">Log in to Admin</a> to create one.
          </p>
        </div>
        {quizzes.length === 0 ? (
          <p className="muted">No quizzes available yet.</p>
        ) : (
          <div className="quiz-list">
            {quizzes.map((q) => (
              <button key={q.id} className="quiz-item" onClick={() => createGame(q.id)}>
                <span>{q.title}</span>
                <span className="meta">{q.question_count} questions →</span>
              </button>
            ))}
          </div>
        )}
      </main>
    );

  if (phase === "lobby")
    return (
      <main className="screen screen--wide screen--center">
        <p className="tagline">Join at {origin.replace(/^https?:\/\//, "")}/join</p>
        <p className="code">{joinCode}</p>
        {qr && <img className="qr" src={qr} alt="Scan to join" width={220} height={220} />}
        <div className="stack" style={{ alignItems: "center", width: "100%" }}>
          <h2>Players ({players.length})</h2>
          {players.length === 0 ? (
            <p className="muted">Waiting for players to join…</p>
          ) : (
            <div className="chips">{players.map((p) => <span key={p.id} className="chip">{p.nickname}</span>)}</div>
          )}
        </div>
        <button className="btn btn-primary btn-lg" onClick={start} disabled={players.length === 0}>
          Start game
        </button>
      </main>
    );

  if (phase === "question" && question)
    return (
      <main className="screen screen--wide">
        <div className="stage-top">
          <span className="progress">Question {question.index + 1} / {question.total}</span>
          <Countdown seconds={question.time_limit_seconds} keySeed={question.id} />
        </div>
        <h1 className="question">{question.text}</h1>
        <p className="tally">{answered.answered} / {answered.total} answered</p>
        <div className="answers-static">
          {question.options.map((o, i) => (
            <div key={o.id} className={`answer answer-${i % 4} answer--static`}>
              <span className="answer-shape" aria-hidden="true">{ANSWER_SHAPES[i % 4]}</span>
              <span className="answer-text">{o.text}</span>
            </div>
          ))}
        </div>
      </main>
    );

  if (phase === "result" && question) {
    const maxCount = Math.max(1, ...question.options.map((o) => distribution[o.id] ?? 0));
    return (
      <main className="screen screen--wide">
        <div className="stage-top">
          <span className="progress">Question {question.index + 1} / {question.total}</span>
        </div>
        <h1 className="question">{question.text}</h1>
        <div className="answers-static">
          {question.options.map((o, i) => {
            const count = distribution[o.id] ?? 0;
            const isCorrect = o.id === correctId;
            return (
              <div
                key={o.id}
                className={`answer answer-${i % 4} answer--static${isCorrect ? " is-correct" : " is-faded"}`}
              >
                <span className="answer-fill" style={{ width: `${(count / maxCount) * 100}%` }} aria-hidden="true" />
                <span className="answer-shape" aria-hidden="true">{ANSWER_SHAPES[i % 4]}</span>
                <span className="answer-text">{o.text}{isCorrect ? "  ✓" : ""}</span>
                <span className="count">{count}</span>
              </div>
            );
          })}
        </div>
        <div className="stack">
          <h2>Leaderboard</h2>
          <Leaderboard entries={board.slice(0, 5)} />
        </div>
        <button className="btn btn-primary btn-lg" onClick={next}>
          {question.index + 1 >= question.total ? "Final results →" : "Next"}
        </button>
      </main>
    );
  }

  if (phase === "over")
    return (
      <main className="screen screen--wide screen--center">
        {brand}
        <h1>Final results</h1>
        <Leaderboard entries={board.slice(0, 5)} />
        <a className="link" href="/host">Host another game</a>
      </main>
    );

  return (
    <main className="screen screen--center">
      <span className="dots" aria-hidden="true"><span /><span /><span /></span>
    </main>
  );
}
