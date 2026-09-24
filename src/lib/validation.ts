export function validateQuizInput(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Input must be an object"] };
  }
  const q = input as Record<string, unknown>;

  if (typeof q.title !== "string" || q.title.trim() === "") {
    errors.push("Quiz title is required");
  }

  const questions = q.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push("Quiz must have at least one question");
  } else {
    questions.forEach((raw, i) => {
      const qq = raw as Record<string, unknown>;
      const label = `Question ${i + 1}`;
      if (typeof qq.text !== "string" || qq.text.trim() === "") {
        errors.push(`${label}: text is required`);
      }
      if (typeof qq.time_limit_seconds !== "number" || qq.time_limit_seconds <= 0) {
        errors.push(`${label}: time_limit_seconds must be a positive number`);
      }
      if (typeof qq.points_base !== "number" || qq.points_base <= 0) {
        errors.push(`${label}: points_base must be a positive number`);
      }
      const options = qq.options;
      if (!Array.isArray(options) || options.length !== 4) {
        errors.push(`${label}: must have exactly 4 options`);
      } else {
        const correct = options.filter(
          (o) => (o as Record<string, unknown>).is_correct === true
        ).length;
        if (correct !== 1) errors.push(`${label}: must have exactly 1 correct option`);
        options.forEach((o, j) => {
          const oo = o as Record<string, unknown>;
          if (typeof oo.text !== "string" || oo.text.trim() === "") {
            errors.push(`${label} option ${j + 1}: text is required`);
          }
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
