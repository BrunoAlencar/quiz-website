export interface Option {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  position: number;
}

export interface Question {
  id: string;
  quiz_id: string;
  text: string;
  position: number;
  time_limit_seconds: number;
  points_base: number;
  options: Option[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  questions: Question[];
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  question_count: number;
}

/** Option as sent to players — never includes is_correct. */
export interface PublicOption {
  id: string;
  text: string;
  position: number;
}

export interface PublicQuestion {
  id: string;
  text: string;
  position: number;
  time_limit_seconds: number;
  options: PublicOption[];
  index: number; // 0-based index within the game
  total: number; // total questions in the game
}

export interface LeaderboardEntry {
  player_id: string;
  nickname: string;
  score: number;
  rank: number;
}

export interface PlayerResult {
  is_correct: boolean;
  points_awarded: number;
  score: number; // running total
  rank: number;
  correct_option_id: string;
}

/** Quiz input coming from the admin UI (no ids yet). */
export interface QuizInput {
  title: string;
  description?: string | null;
  questions: {
    text: string;
    time_limit_seconds: number;
    points_base: number;
    options: { text: string; is_correct: boolean }[];
  }[];
}

// ---- Socket.IO event contracts ----

export interface ClientToServerEvents {
  "host:create-game": (
    payload: { quizId: string },
    ack: (res: { gameId: string; joinCode: string } | { error: string }) => void
  ) => void;
  "host:join-room": (payload: { gameId: string }) => void;
  "host:start": (payload: { gameId: string }) => void;
  "host:next": (payload: { gameId: string }) => void;
  "player:join": (
    payload: { joinCode: string; nickname: string },
    ack: (
      res: { playerId: string; gameId: string; nickname: string } | { error: string }
    ) => void
  ) => void;
  "player:submit": (payload: { gameId: string; playerId: string; optionId: string }) => void;
  "player:resync": (payload: { gameId: string; playerId: string }) => void;
}

export interface ServerToClientEvents {
  "lobby:players": (payload: { players: { id: string; nickname: string }[] }) => void;
  "game:question": (payload: PublicQuestion) => void;
  "game:answered-count": (payload: { answered: number; total: number }) => void;
  "game:question-result": (payload: {
    correct_option_id: string;
    distribution: Record<string, number>; // optionId -> count
    leaderboard: LeaderboardEntry[];
  }) => void;
  "player:result": (payload: PlayerResult) => void;
  "game:over": (payload: { leaderboard: LeaderboardEntry[] }) => void;
  "game:error": (payload: { message: string }) => void;
}
