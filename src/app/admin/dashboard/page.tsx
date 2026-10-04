"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Leaderboard } from "@/components/Leaderboard";
import type { DashboardOverview, PastGame, QuestionStat, LeaderboardEntry } from "@/types";

type Load = "loading" | "ready" | "unauthorized" | "error";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function DashboardPage() {
  const [load, setLoad] = useState<Load>("loading");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [games, setGames] = useState<PastGame[]>([]);
  const [openGameId, setOpenGameId] = useState<string | null>(null);
  const [rankings, setRankings] = useState<Record<string, LeaderboardEntry[]>>({});
  const [rankingError, setRankingError] = useState("");
  const [quizId, setQuizId] = useState("");
  const [questions, setQuestions] = useState<QuestionStat[] | null>(null);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/dashboard", { credentials: "include" });
        if (res.status === 401) { setLoad("unauthorized"); return; }
        if (!res.ok) { setLoad("error"); return; }
        const data: { overview: DashboardOverview; games: PastGame[] } = await res.json();
        setOverview(data.overview);
        setGames(data.games);
        if (data.games.length > 0) setQuizId(data.games[0].quiz_id);
        setLoad("ready");
      } catch {
        setLoad("error");
      }
    })();
  }, []);

  // Quizzes that have at least one finished game, most recently played first.
  const quizzes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of games) if (!seen.has(g.quiz_id)) seen.set(g.quiz_id, g.quiz_title);
    return [...seen].map(([id, title]) => ({ id, title }));
  }, [games]);

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;
    setQuestions(null);
    setStatsError("");
    (async () => {
      try {
        const res = await fetch(`/api/admin/quizzes/${quizId}/stats`, { credentials: "include" });
        if (!res.ok) throw new Error();
        const data: { questions: QuestionStat[] } = await res.json();
        if (!cancelled) setQuestions(data.questions);
      } catch {
        if (!cancelled) setStatsError("Could not load question stats.");
      }
    })();
    return () => { cancelled = true; };
  }, [quizId]);

  async function toggleGame(id: string) {
    setRankingError("");
    if (openGameId === id) { setOpenGameId(null); return; }
    setOpenGameId(id);
    if (rankings[id]) return;
    try {
      const res = await fetch(`/api/admin/games/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data: { ranking: LeaderboardEntry[] } = await res.json();
      setRankings((r) => ({ ...r, [id]: data.ranking }));
    } catch {
      setRankingError("Could not load this game's ranking.");
    }
  }

  if (load === "loading")
    return (
      <main className="screen screen--center">
        <span className="dots" aria-hidden="true"><span /><span /><span /></span>
      </main>
    );

  if (load === "unauthorized")
    return (
      <main className="screen screen--narrow">
        <h1>Dashboard</h1>
        <p className="tagline">
          <Link className="link" href="/admin">Log in to Admin</Link> to see past games.
        </p>
      </main>
    );

  if (load === "error" || !overview)
    return (
      <main className="screen screen--narrow">
        <h1>Dashboard</h1>
        <p className="error">Could not load the dashboard. Please try again.</p>
      </main>
    );

  return (
    <main className="screen screen--wide">
      <div className="row-between">
        <h1>Dashboard</h1>
        <Link className="link" href="/admin">← Quizzes</Link>
      </div>

      <section className="stats" aria-label="Overview">
        <div className="stat"><small>Games played</small><b>{overview.games_played}</b></div>
        <div className="stat"><small>Participants</small><b>{overview.participants}</b></div>
        <div className="stat">
          <small>Average accuracy</small>
          <b>{overview.accuracy_pct === null ? "–" : `${overview.accuracy_pct}%`}</b>
        </div>
        <div className="stat">
          <small>Most played quiz</small>
          <b className="is-text">{overview.top_quiz_title ?? "–"}</b>
        </div>
      </section>

      <section className="stack">
        <h2>Game history</h2>
        {games.length === 0 ? (
          <p className="muted">No finished games yet.</p>
        ) : (
          <div className="quiz-list">
            {games.map((g) => {
              const open = openGameId === g.id;
              const ranking = rankings[g.id];
              return (
                <div key={g.id} className="stack-sm">
                  <button
                    className="quiz-item game-row"
                    aria-expanded={open}
                    onClick={() => toggleGame(g.id)}
                  >
                    <span>{g.quiz_title}</span>
                    <span className="meta">
                      {formatDate(g.ended_at)} · {g.player_count} {g.player_count === 1 ? "player" : "players"}
                      {g.winner_nickname ? ` · 🏆 ${g.winner_nickname} (${g.winner_score})` : ""}
                    </span>
                  </button>
                  {open && (
                    <div className="game-detail">
                      {ranking ? (
                        ranking.length > 0
                          ? <Leaderboard entries={ranking} />
                          : <p className="muted">No players in this game.</p>
                      ) : rankingError ? (
                        <p className="error">{rankingError}</p>
                      ) : (
                        <p className="muted">Loading…</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {quizzes.length > 0 && (
        <section className="stack">
          <h2>Question difficulty</h2>
          <label className="field">
            <span>Quiz</span>
            <select value={quizId} onChange={(e) => setQuizId(e.target.value)}>
              {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
            </select>
          </label>
          <p className="muted" style={{ margin: 0 }}>
            Hardest first. Covers games played since this quiz was last saved; editing a quiz resets its answer history.
          </p>
          {statsError && <p className="error">{statsError}</p>}
          {questions && questions.map((s) => (
            <div key={s.question_id} className="qstat">
              <div className="qstat-head">
                <span>{s.text}</span>
                <span className="pct">{s.correct_pct === null ? "–" : `${s.correct_pct}%`}</span>
              </div>
              <div className="bar" aria-hidden="true"><i style={{ width: `${s.correct_pct ?? 0}%` }} /></div>
              <small>
                {s.answers === 0
                  ? "No answers recorded"
                  : `${s.correct} of ${s.answers} correct · ${((s.avg_response_ms ?? 0) / 1000).toFixed(1)}s avg`}
              </small>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
