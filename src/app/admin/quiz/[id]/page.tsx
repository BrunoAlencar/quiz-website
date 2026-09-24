"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ANSWER_SHAPES } from "@/components/AnswerButton";

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
    <main className="screen screen--wide">
      <div className="row-between">
        <h1>Edit quiz</h1>
        <Link className="link" href="/admin">← All quizzes</Link>
      </div>

      <div className="card stack">
        <label className="field">
          <span>Title</span>
          <input placeholder="Quiz title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Description</span>
          <input placeholder="A short summary (optional)" value={description}
            onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>

      {questions.map((q, qi) => (
        <div className="card stack" key={qi}>
          <div className="row-between">
            <h3>Question {qi + 1}</h3>
            <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(qi)}>Remove</button>
          </div>
          <label className="field">
            <span>Question text</span>
            <input placeholder="What do you want to ask?" value={q.text}
              onChange={(e) => updateQuestion(qi, { text: e.target.value })} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Time limit (seconds)</span>
              <input type="number" min={1} value={q.time_limit_seconds}
                onChange={(e) => updateQuestion(qi, { time_limit_seconds: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span>Points</span>
              <input type="number" min={1} value={q.points_base}
                onChange={(e) => updateQuestion(qi, { points_base: Number(e.target.value) })} />
            </label>
          </div>
          <div className="stack-sm">
            <span className="field"><span>Answers — select the correct one</span></span>
            {q.options.map((o, oi) => (
              <div key={oi} className={`opt opt-${oi}${o.is_correct ? " is-correct" : ""}`}>
                <input type="radio" name={`correct-${qi}`} checked={o.is_correct}
                  onChange={() => setCorrect(qi, oi)}
                  aria-label={`Mark answer ${oi + 1} as correct`} />
                <span className="opt-shape" aria-hidden="true">{ANSWER_SHAPES[oi]}</span>
                <input className="opt-text" placeholder={`Answer ${oi + 1}`} value={o.text}
                  onChange={(e) => updateOption(qi, oi, { text: e.target.value })} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="btn-row">
        <button className="btn" onClick={addQuestion}>Add question</button>
        <button className="btn btn-primary" onClick={save}>Save quiz</button>
      </div>
      {message && <p className={message === "Saved" ? "notice" : "error"}>{message}</p>}
    </main>
  );
}
