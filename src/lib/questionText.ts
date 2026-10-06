const FENCE = /```[a-z]*\n([\s\S]*?)\n?```/;

/**
 * Splits a question's text into its prompt and an optional code snippet.
 * A snippet is written inline as a fenced block (``` or ```js on its own line).
 */
export function parseQuestionText(text: string): { prompt: string; code: string | null } {
  const match = FENCE.exec(text);
  if (!match) return { prompt: text, code: null };
  const before = text.slice(0, match.index).trim();
  const after = text.slice(match.index + match[0].length).trim();
  return { prompt: [before, after].filter(Boolean).join(" "), code: match[1] };
}
