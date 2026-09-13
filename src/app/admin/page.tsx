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
      <main className="container">
        <h1>Admin login</h1>
        <form onSubmit={login} className="card">
          <input type="password" placeholder="Admin password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p style={{ color: "var(--red)" }}>{error}</p>}
          <button type="submit" style={{ marginTop: 12 }}>Log in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Quizzes</h1>
      <button onClick={createBlank}>+ New quiz</button>
      <ul>
        {quizzes.map((q) => (
          <li key={q.id}>
            <Link href={`/admin/quiz/${q.id}`}>{q.title}</Link> ({q.question_count} questions)
          </li>
        ))}
      </ul>
    </main>
  );
}
