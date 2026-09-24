"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Summary { id: string; title: string; question_count: number; }

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [quizzes, setQuizzes] = useState<Summary[]>([]);
  const [error, setError] = useState("");

  async function loadQuizzes() {
    const res = await fetch("/api/admin/quizzes", { credentials: "include" });
    if (res.ok) { setQuizzes(await res.json()); setAuthed(true); }
    else setAuthed(false);
  }
  useEffect(() => { loadQuizzes(); }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) loadQuizzes();
    else setError("Invalid password");
  }

  async function createBlank() {
    const res = await fetch("/api/admin/quizzes", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Untitled quiz",
        questions: [{
          text: "New question", time_limit_seconds: 20, points_base: 1000,
          options: [
            { text: "Option A", is_correct: true }, { text: "Option B", is_correct: false },
            { text: "Option C", is_correct: false }, { text: "Option D", is_correct: false },
          ],
        }],
      }),
    });
    if (res.ok) { const { id } = await res.json(); window.location.href = `/admin/quiz/${id}`; }
  }

  if (!authed) {
    return (
      <main className="screen screen--narrow">
        <div className="stack">
          <h1>Admin</h1>
          <p className="tagline">Log in to create and edit quizzes.</p>
        </div>
        <form onSubmit={login} className="card stack">
          <label className="field">
            <span>Password</span>
            <input type="password" placeholder="Admin password" autoFocus
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block">Log in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="screen screen--wide">
      <div className="row-between">
        <h1>Quizzes</h1>
        <button className="btn btn-primary" onClick={createBlank}>New quiz</button>
      </div>
      {quizzes.length === 0 ? (
        <p className="muted">No quizzes yet. Create your first one to get started.</p>
      ) : (
        <div className="quiz-list">
          {quizzes.map((q) => (
            <Link key={q.id} className="quiz-item" href={`/admin/quiz/${q.id}`}>
              <span>{q.title}</span>
              <span className="meta">{q.question_count} questions →</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
