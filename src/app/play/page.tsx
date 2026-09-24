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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<PlayerResult | null>(null);
  const [finalBoard, setFinalBoard] = useState<LeaderboardEntry[]>([]);
  const [nickname, setNickname] = useState<string>("");

  useEffect(() => {
    setNickname(sessionStorage.getItem("nickname") ?? "");
    const socket = getSocket();
    const gameId = sessionStorage.getItem("gameId");
    const playerId = sessionStorage.getItem("playerId");
    if (gameId && playerId) socket.emit("player:resync", { gameId, playerId });

    socket.on("game:question", (q) => {
      setQuestion(q);
      setResult(null);
      setSelectedId(null);
      setPhase("question");
    });
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
    setSelectedId(optionId);
    setPhase("answered");
  }

  // --- Waiting for the host ---
  if (phase === "waiting")
    return (
      <main className="stage stage-center">
        <h1 className="bignum" aria-hidden="true">👋</h1>
        <h2 className="verdict">You&rsquo;re in{nickname ? `, ${nickname}` : ""}</h2>
        <p className="lead muted">Keep this screen open. The game starts soon.</p>
        <span className="dots" aria-hidden="true"><span /><span /><span /></span>
      </main>
    );

  // --- Game over ---
  if (phase === "over") {
    const me = sessionStorage.getItem("playerId");
    const mine = finalBoard.find((e) => e.player_id === me);
    return (
      <main className="stage stage-center">
        <p className="muted">Final score</p>
        {mine ? (
          <>
            <p className="bignum">{mine.score}</p>
            <p className="lead">You finished #{mine.rank} of {finalBoard.length}</p>
          </>
        ) : (
          <p className="lead">Thanks for playing!</p>
        )}
      </main>
    );
  }

  // --- Per-question result (correct / wrong / didn't answer) ---
  if (phase === "result") {
    if (!result)
      return (
        <main className="stage stage-center result result--timeup">
          <div className="verdict-badge" aria-hidden="true">⏱</div>
          <h1 className="verdict">Time&rsquo;s up</h1>
          <p className="verdict-sub">No answer this round.</p>
        </main>
      );
    const correct = result.is_correct;
    return (
      <main className={`stage stage-center result ${correct ? "result--correct" : "result--wrong"}`}>
        <div className="verdict-badge" aria-hidden="true">{correct ? "✓" : "✕"}</div>
        <h1 className="verdict">{correct ? "Correct" : "Not quite"}</h1>
        <p className="verdict-points">+{result.points_awarded}</p>
        <p className="verdict-sub">Rank #{result.rank}, {result.score} points total</p>
      </main>
    );
  }

  // --- Live question (tappable) or locked after answering ---
  if ((phase === "question" || phase === "answered") && question) {
    const locked = phase === "answered";
    return (
      <main className="stage">
        <div className="stage-top">
          <span className="progress">Question {question.index + 1} / {question.total}</span>
          <Countdown seconds={question.time_limit_seconds} keySeed={question.id} />
        </div>

        <div className="question-wrap">
          <h1 className="question">{question.text}</h1>
        </div>

        <div className="answers" role="group" aria-label="Answers">
          {question.options.map((o, i) => (
            <AnswerButton
              key={o.id}
              index={i}
              text={o.text}
              disabled={locked}
              selected={locked && selectedId === o.id}
              dimmed={locked && selectedId !== o.id}
              onClick={() => submit(o.id)}
            />
          ))}
        </div>

        {locked && <p className="muted" style={{ textAlign: "center", margin: 0 }}>Locked in — waiting for the others…</p>}
      </main>
    );
  }

  return (
    <main className="stage stage-center">
      <span className="dots" aria-hidden="true"><span /><span /><span /></span>
    </main>
  );
}
