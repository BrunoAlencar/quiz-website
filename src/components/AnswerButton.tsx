"use client";
export const ANSWER_SHAPES = ["▲", "◆", "●", "■"];
const SHAPES = ANSWER_SHAPES;

export function AnswerButton({
  index, text, onClick, disabled, dimmed, selected,
}: {
  index: number;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  dimmed?: boolean;
  selected?: boolean;
}) {
  const tone = index % 4;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`answer answer-${tone}${selected ? " is-selected" : ""}${dimmed ? " is-dimmed" : ""}`}
    >
      <span className="answer-shape" aria-hidden="true">{SHAPES[tone]}</span>
      <span className="answer-text">{text}</span>
    </button>
  );
}
