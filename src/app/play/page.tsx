"use client";
import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socketClient";
import { AnswerButton } from "@/components/AnswerButton";
import { Countdown } from "@/components/Countdown";
import type { PublicQuestion, PlayerResult, LeaderboardEntry } from "@/types";

type Phase = "waiting" | "question" | "answered" | "result" | "over";

export default function PlayPage() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [result, setResult] = useState<PlayerResult | null>(null);
  const [finalBoard, setFinalBoard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const gameId = sessionStorage.getItem("gameId");
    const playerId = sessionStorage.getItem("playerId");
    if (gameId && playerId) socket.emit("player:resync", { gameId, playerId });

    socket.on("game:question", (q) => { setQuestion(q); setResult(null); setPhase("question"); });
    socket.on("player:result", (r) => { setResult(r); });
    socket.on("game:question-result", () => { setPhase("result"); });
    socket.on("game:over", ({ leaderboard }) => { setFinalBoard(leaderboard); setPhase("over"); });

    return () => {
      socket.off("game:question"); socket.off("player:result");
      socket.off("game:question-result"); socket.off("game:over");
    };
  }, []);

  function submit(optionId: string) {
    const socket = getSocket();
    const gameId = sessionStorage.getItem("gameId")!;
    const playerId = sessionStorage.getItem("playerId")!;
    socket.emit("player:submit", { gameId, playerId, optionId });
    setPhase("answered");
  }

  if (phase === "waiting")
    return <main className="container"><h1>You're in!</h1><p>Waiting for the host to start…</p></main>;

  if (phase === "over") {
    const me = sessionStorage.getItem("playerId");
    const mine = finalBoard.find((e) => e.player_id === me);
    return (
      <main className="container">
        <h1>Game over</h1>
        {mine && <p>You finished #{mine.rank} with {mine.score} points.</p>}
      </main>
    );
  }

  if ((phase === "result" || phase === "answered") && result) {
    return (
      <main className="container">
        <h1>{result.is_correct ? "Correct!" : "Wrong"}</h1>
        <p>+{result.points_awarded} points — rank #{result.rank}</p>
      </main>
    );
  }

  if (phase === "answered")
    return <main className="container"><h1>Answer locked</h1><p>Waiting for others…</p></main>;

  if (phase === "question" && question)
    return (
      <main className="container">
        <Countdown seconds={question.time_limit_seconds} keySeed={question.id} />
        <p>Question {question.index + 1} of {question.total}</p>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {question.options.map((o, i) => (
            <AnswerButton key={o.id} index={i} text={o.text} onClick={() => submit(o.id)} />
          ))}
        </div>
      </main>
    );

  return <main className="container"><p>Loading…</p></main>;
}
