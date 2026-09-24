import type { Question } from "@/types";

export interface LivePlayer { id: string; nickname: string; score: number; }

export interface LiveGame {
  id: string;
  quizId: string;
  joinCode: string;
  questions: Question[];
  players: Map<string, LivePlayer>;
  currentIndex: number;
  questionStartMs: number | null;
  answers: Map<string, { optionId: string; isCorrect: boolean; points: number }>;
  status: "lobby" | "in_progress" | "ended";
  /** Handle for the pending per-question timeout, if a question is in progress. */
  questionTimer?: NodeJS.Timeout;
  /**
   * Guards against double-resolution of the current question: set to false
   * when a question starts, and to true the moment it is revealed (whether
   * triggered by all-answered, the timer, or a disconnect completing the
   * round). Undefined/false means "not yet resolved".
   */
  questionResolved?: boolean;
}

export class GameStore {
  private byId = new Map<string, LiveGame>();
  private idByCode = new Map<string, string>();

  create(game: LiveGame): void {
    this.byId.set(game.id, game);
    this.idByCode.set(game.joinCode, game.id);
  }
  get(id: string): LiveGame | undefined { return this.byId.get(id); }
  getByCode(code: string): LiveGame | undefined {
    const id = this.idByCode.get(code);
    return id ? this.byId.get(id) : undefined;
  }
  delete(id: string): void {
    const g = this.byId.get(id);
    if (g) this.idByCode.delete(g.joinCode);
    this.byId.delete(id);
  }
}
