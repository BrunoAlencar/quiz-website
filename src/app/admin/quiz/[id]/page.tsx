"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface EditOption { text: string; is_correct: boolean; }
interface EditQuestion { text: string; time_limit_seconds: number; points_base: number; options: EditOption[]; }

export default function QuizEditor() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<EditQuestion[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/quizzes/${id}`, { credentials: "include" });
      if (!res.ok) { setMessage("Could not load quiz"); return; }
      const quiz = await res.json();
      setTitle(quiz.title);
      setDescription(quiz.description ?? "");
      setQuestions(
        quiz.questions.map((q: any) => ({
          text: q.text, time_limit_seconds: q.time_limit_seconds, points_base: q.points_base,
          options: q.options.map((o: any) => ({ text: o.text, is_correct: o.is_correct })),
        }))
      );
    })();
  }, [id]);

  function updateQuestion(i: number, patch: Partial<EditQuestion>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function updateOption(qi: number, oi: number, patch: Partial<EditOption>) {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qi
          ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) }
          : q
      )
    );
  }
  function setCorrect(qi: number, oi: number) {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qi
          ? { ...q, options: q.options.map((o, j) => ({ ...o, is_correct: j === oi })) }
          : q
      )
    );
  }
  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      { text: "New question", time_limit_seconds: 20, points_base: 1000,
        options: [
          { text: "Option A", is_correct: true }, { text: "Option B", is_correct: false },
          { text: "Option C", is_correct: false }, { text: "Option D", is_correct: false },
        ] },
    ]);
  }
  function removeQuestion(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }

  async function save() {
    setMessage("");
    const res = await fetch(`/api/admin/quizzes/${id}`, {
      method: "PUT", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, description, questions }),
    });
    if (res.ok) setMessage("Saved");
    else {
      const body = await res.json().catch(() => ({}));
      setMessage((body.errors ?? ["Save failed"]).join("; "));
    }
  }

  return (
    <main className="container">
      <h1>Edit quiz</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Description" value={description}
          onChange={(e) => setDescription(e.target.value)} style={{ marginTop: 8 }} />
      </div>

      {questions.map((q, qi) => (
        <div className="card" key={qi} style={{ marginBottom: 16 }}>
          <input placeholder="Question text" value={q.text}
            onChange={(e) => updateQuestion(qi, { text: e.target.value })} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input type="number" min={1} value={q.time_limit_seconds}
              onChange={(e) => updateQuestion(qi, { time_limit_seconds: Number(e.target.value) })} />
            <input type="number" min={1} value={q.points_base}
              onChange={(e) => updateQuestion(qi, { points_base: Number(e.target.value) })} />
          </div>
          {q.options.map((o, oi) => (
            <div key={oi} style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <input type="radio" name={`correct-${qi}`} checked={o.is_correct}
                onChange={() => setCorrect(qi, oi)} />
              <input value={o.text} onChange={(e) => updateOption(qi, oi, { text: e.target.value })} />
            </div>
          ))}
          <button onClick={() => removeQuestion(qi)} style={{ marginTop: 8 }}>Remove question</button>
        </div>
      ))}

      <button onClick={addQuestion}>+ Add question</button>{" "}
      <button onClick={save}>Save</button>
      {message && <p>{message}</p>}
    </main>
  );
}
