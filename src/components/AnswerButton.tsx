"use client";
const COLORS = ["var(--red)", "var(--blue)", "var(--yellow)", "var(--green)"];
const SHAPES = ["▲", "◆", "●", "■"];

export function AnswerButton({
  index, text, onClick, disabled, dimmed,
}: {
  index: number; text: string; onClick?: () => void; disabled?: boolean; dimmed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: COLORS[index % 4], color: "#fff", border: "none", borderRadius: 12,
        padding: "24px 16px", fontSize: 20, width: "100%", opacity: dimmed ? 0.35 : 1,
        display: "flex", gap: 12, alignItems: "center",
      }}
    >
      <span style={{ fontSize: 24 }}>{SHAPES[index % 4]}</span>
      <span>{text}</span>
    </button>
  );
}
