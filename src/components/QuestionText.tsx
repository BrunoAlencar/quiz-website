import { parseQuestionText } from "@/lib/questionText";

export function QuestionText({ text }: { text: string }) {
  const { prompt, code } = parseQuestionText(text);
  if (code === null) return <h1 className="question">{prompt}</h1>;
  return (
    <div className="question-block">
      <h1 className="question">{prompt}</h1>
      <pre className="question-code"><code>{code}</code></pre>
    </div>
  );
}
