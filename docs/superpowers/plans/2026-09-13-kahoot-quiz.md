# Kahoot-like Live Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live, synchronized, Kahoot-style quiz web app where a presenter drives a shared screen and players join from phones to answer timed multiple-choice questions on a speed-based leaderboard.

**Architecture:** One Next.js (App Router, TypeScript) app served by a custom Node HTTP server that also hosts a Socket.IO server for real-time play. Persistent data lives in PostgreSQL accessed with raw SQL through `node-postgres` (`pg`). Live game state (current question, timer, running scores) lives in-memory in a `Map` on the server; answers and final scores are persisted to Postgres. The server is the sole authority for timing, correctness, and scoring.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript 5, Socket.IO 4 (server + client), `pg` 8, `tsx` (run/watch the TS custom server), Vitest 2 (unit + integration tests), `qrcode` (QR generation).

## Global Constraints

- Node.js >= 20; TypeScript strict mode enabled.
- Database access is raw SQL via `pg` only — NO ORM (no Prisma, Drizzle, Kysely).
- Migrations are plain `.sql` files applied by a small Node runner; never auto-sync.
- Every question has exactly 4 options with exactly 1 correct; enforced in the API validation layer (client + server).
- Server is authoritative for timing, correctness, and scoring; never trust client-supplied timing.
- Scoring: `points = round(points_base * (1 - (response_ms / time_limit_ms) * SPEED_FACTOR))` for correct answers, else 0. `SPEED_FACTOR = 0.5`, exported as a named constant.
- Join code: 6 characters from the unambiguous alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L).
- Config via env: `DATABASE_URL`, `DATABASE_URL_TEST`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `PORT`.
- No mid-game joins (v1); first answer per player per question wins; duplicate nicknames in a game get a numeric suffix.
- Commit after every task using Conventional Commit messages.

---

## File Structure

```
package.json                     # scripts + deps
tsconfig.json                    # strict TS, path alias @/* -> src/*
next.config.js                   # Next config (custom server compatible)
vitest.config.ts                 # test config, node env
.env.example                     # documented env vars
server.ts                        # custom HTTP server: Next request handler + Socket.IO

db/
  pool.ts                        # pg Pool singleton (uses DATABASE_URL)
  migrate.ts                     # applies db/migrations/*.sql in order, tracks applied
  migrations/
    001_init.sql                 # all tables + indexes

src/
  types/index.ts                 # shared domain types + Socket.IO event payload types
  lib/
    scoring.ts                   # SPEED_FACTOR, computeScore()
    joinCode.ts                  # JOIN_CODE_ALPHABET, generateJoinCode()
    validation.ts                # validateQuizInput()
  server/
    repositories/
      quizzes.ts                 # createQuiz, getQuiz, listQuizzes, updateQuiz, getQuizForPlay
      games.ts                   # createGame, getGameByCode, setGameStatus
      players.ts                 # createPlayer, listPlayers, setPlayerScore
      answers.ts                 # recordAnswer
    gameState.ts                 # in-memory GameStore (Map) + LiveGame type
    gameManager.ts               # lobby/question/result/end orchestration (pure-ish)
    auth.ts                      # verifyAdminPassword, signSession, verifySession
    socket.ts                    # registerSocketHandlers(io) — wires events to gameManager
  app/
    layout.tsx                   # root layout
    globals.css                  # base styles (Kahoot-ish colors)
    page.tsx                     # landing: links to /join and /host
    join/page.tsx                # player: enter code + nickname
    play/page.tsx                # player: live question/answer/result
    host/page.tsx                # presenter: quiz picker, lobby, live screen
    admin/
      page.tsx                   # admin: login + quiz list
      quiz/[id]/page.tsx         # admin: create/edit quiz
    api/
      admin/
        login/route.ts           # POST password -> session cookie
        quizzes/route.ts         # GET list, POST create
        quizzes/[id]/route.ts    # GET one, PUT update
  components/
    AnswerButton.tsx             # colored/shaped answer button
    Countdown.tsx                # timer display
    Leaderboard.tsx              # ranked list

tests/
  lib/scoring.test.ts
  lib/joinCode.test.ts
  lib/validation.test.ts
  server/repositories.test.ts    # against DATABASE_URL_TEST
  server/gameManager.test.ts
  server/socket.test.ts          # socket.io-client end-to-end flow
```

---

## Task 1: Project scaffolding & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `vitest.config.ts`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `.gitignore` (already exists — extend)

**Interfaces:**
- Consumes: nothing.
- Produces: runnable Next.js app skeleton; `npm run dev`, `npm test`, `npm run build`, `npm run migrate` scripts.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "quiz-website",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch server.ts",
    "build": "next build",
    "start": "NODE_ENV=production tsx server.ts",
    "migrate": "tsx db/migrate.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io": "^4.7.5",
    "socket.io-client": "^4.7.5",
    "pg": "^8.12.0",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/pg": "^8.11.6",
    "@types/qrcode": "^1.5.5",
    "typescript": "^5.5.3",
    "tsx": "^4.16.2",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "skipLibCheck": true,
    "allowJs": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
export default nextConfig;
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

- [ ] **Step 5: Create `.env.example`**

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/quiz
DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/quiz_test
ADMIN_PASSWORD=change-me
SESSION_SECRET=change-me-too-long-random
PORT=3000
```

- [ ] **Step 6: Create root layout, styles, and landing page**

`src/app/layout.tsx`:

```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Quiz", description: "Live quiz game" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/globals.css`:

```css
:root {
  --red: #e21b3c; --blue: #1368ce; --yellow: #d89e00; --green: #26890c;
  --bg: #0f1020; --fg: #ffffff;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg); }
button { font: inherit; cursor: pointer; }
.container { max-width: 900px; margin: 0 auto; padding: 24px; }
.card { background: #1b1c33; border-radius: 12px; padding: 20px; }
input { padding: 12px; border-radius: 8px; border: 1px solid #333; width: 100%; }
```

`src/app/page.tsx`:

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <h1>Quiz</h1>
      <p><Link href="/join">Join a game</Link></p>
      <p><Link href="/host">Host a game</Link></p>
      <p><Link href="/admin">Admin</Link></p>
    </main>
  );
}
```

- [ ] **Step 7: Extend `.gitignore`**

Ensure it contains: `node_modules/`, `.next/`, `.env`, `.env.local`, `*.log`, `.DS_Store`, `next-env.d.ts`.

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: dependencies installed, `node_modules/` present, no error.

- [ ] **Step 9: Verify test runner works**

Run: `npm test`
Expected: Vitest runs and reports "No test files found" (exit 0) — confirms tooling is wired.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with TypeScript, Vitest, and scripts"
```

---

## Task 2: Shared domain & event types

**Files:**
- Create: `src/types/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Quiz`, `Question`, `Option`, `QuizForPlay`, `PublicQuestion`, `PublicOption`, `LeaderboardEntry`, `PlayerResult`, and the Socket.IO event payload types `ClientToServerEvents`, `ServerToClientEvents`. These names are used by repositories, gameManager, socket layer, and UI.

- [ ] **Step 1: Write the types file**

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared domain and socket event types"
```

---

## Task 3: Scoring logic (TDD)

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `tests/lib/scoring.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SPEED_FACTOR: number` and `computeScore(args: { isCorrect: boolean; responseMs: number; timeLimitMs: number; pointsBase: number }): number`.

- [ ] **Step 1: Write the failing test**

`tests/lib/scoring.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeScore, SPEED_FACTOR } from "@/lib/scoring";

describe("computeScore", () => {
  it("returns 0 for an incorrect answer", () => {
    expect(computeScore({ isCorrect: false, responseMs: 100, timeLimitMs: 20000, pointsBase: 1000 })).toBe(0);
  });

  it("awards ~full points for an instant correct answer", () => {
    expect(computeScore({ isCorrect: true, responseMs: 0, timeLimitMs: 20000, pointsBase: 1000 })).toBe(1000);
  });

  it("awards half points at the buzzer with SPEED_FACTOR 0.5", () => {
    expect(computeScore({ isCorrect: true, responseMs: 20000, timeLimitMs: 20000, pointsBase: 1000 })).toBe(500);
  });

  it("scales linearly in between", () => {
    // halfway through, 1 - 0.5*0.5 = 0.75
    expect(computeScore({ isCorrect: true, responseMs: 10000, timeLimitMs: 20000, pointsBase: 1000 })).toBe(750);
  });

  it("clamps responseMs above the limit to the limit", () => {
    expect(computeScore({ isCorrect: true, responseMs: 999999, timeLimitMs: 20000, pointsBase: 1000 })).toBe(500);
  });

  it("exposes SPEED_FACTOR as 0.5", () => {
    expect(SPEED_FACTOR).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/scoring.test.ts`
Expected: FAIL — cannot find module `@/lib/scoring`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/scoring.ts`:

```ts
export const SPEED_FACTOR = 0.5;

export function computeScore(args: {
  isCorrect: boolean;
  responseMs: number;
  timeLimitMs: number;
  pointsBase: number;
}): number {
  const { isCorrect, responseMs, timeLimitMs, pointsBase } = args;
  if (!isCorrect) return 0;
  const clamped = Math.min(Math.max(responseMs, 0), timeLimitMs);
  const factor = 1 - (clamped / timeLimitMs) * SPEED_FACTOR;
  return Math.round(pointsBase * factor);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/scoring.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts tests/lib/scoring.test.ts
git commit -m "feat: add speed-based scoring logic"
```

---

## Task 4: Join-code generation (TDD)

**Files:**
- Create: `src/lib/joinCode.ts`
- Test: `tests/lib/joinCode.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `JOIN_CODE_ALPHABET: string`, `JOIN_CODE_LENGTH: number` (=6), `generateJoinCode(): string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { generateJoinCode, JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from "@/lib/joinCode";

describe("generateJoinCode", () => {
  it("returns a 6-character code", () => {
    expect(generateJoinCode()).toHaveLength(JOIN_CODE_LENGTH);
    expect(JOIN_CODE_LENGTH).toBe(6);
  });

  it("uses only the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      for (const ch of generateJoinCode()) {
        expect(JOIN_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("excludes ambiguous characters 0 O 1 I L", () => {
    for (const bad of ["0", "O", "1", "I", "L"]) {
      expect(JOIN_CODE_ALPHABET).not.toContain(bad);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/joinCode.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/joinCode.ts`:

```ts
import { randomInt } from "node:crypto";

export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/joinCode.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/joinCode.ts tests/lib/joinCode.test.ts
git commit -m "feat: add unambiguous join-code generator"
```

---

## Task 5: Quiz input validation (TDD)

**Files:**
- Create: `src/lib/validation.ts`
- Test: `tests/lib/validation.test.ts`

**Interfaces:**
- Consumes: `QuizInput` from `@/types`.
- Produces: `validateQuizInput(input: unknown): { valid: boolean; errors: string[] }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { validateQuizInput } from "@/lib/validation";

const validQuestion = {
  text: "Capital of France?",
  time_limit_seconds: 20,
  points_base: 1000,
  options: [
    { text: "Paris", is_correct: true },
    { text: "London", is_correct: false },
    { text: "Rome", is_correct: false },
    { text: "Berlin", is_correct: false },
  ],
};

describe("validateQuizInput", () => {
  it("accepts a well-formed quiz", () => {
    const res = validateQuizInput({ title: "Geo", questions: [validQuestion] });
    expect(res).toEqual({ valid: true, errors: [] });
  });

  it("rejects an empty title", () => {
    const res = validateQuizInput({ title: "  ", questions: [validQuestion] });
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toMatch(/title/i);
  });

  it("rejects a quiz with no questions", () => {
    const res = validateQuizInput({ title: "Geo", questions: [] });
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toMatch(/at least one question/i);
  });

  it("rejects a question without exactly 4 options", () => {
    const q = { ...validQuestion, options: validQuestion.options.slice(0, 3) };
    const res = validateQuizInput({ title: "Geo", questions: [q] });
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toMatch(/exactly 4 options/i);
  });

  it("rejects a question without exactly 1 correct option", () => {
    const q = {
      ...validQuestion,
      options: validQuestion.options.map((o) => ({ ...o, is_correct: false })),
    };
    const res = validateQuizInput({ title: "Geo", questions: [q] });
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toMatch(/exactly 1 correct/i);
  });

  it("rejects a non-object input", () => {
    expect(validateQuizInput(null).valid).toBe(false);
  });

  it("rejects a non-positive time limit", () => {
    const q = { ...validQuestion, time_limit_seconds: 0 };
    const res = validateQuizInput({ title: "Geo", questions: [q] });
    expect(res.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/validation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/validation.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/validation.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts tests/lib/validation.test.ts
git commit -m "feat: add quiz input validation"
```

---

## Task 6: Database schema, pool, and migration runner

**Files:**
- Create: `db/pool.ts`, `db/migrate.ts`, `db/migrations/001_init.sql`

**Interfaces:**
- Consumes: env `DATABASE_URL`.
- Produces: `getPool(): Pool` (from `db/pool.ts`), a runnable migration script, and the schema tables from the spec.

- [ ] **Step 1: Create the migration SQL**

`db/migrations/001_init.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL,
  time_limit_seconds INTEGER NOT NULL DEFAULT 20,
  points_base INTEGER NOT NULL DEFAULT 1000
);
CREATE INDEX idx_questions_quiz ON questions(quiz_id);

CREATE TABLE options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL
);
CREATE INDEX idx_options_question ON options(question_id);

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE RESTRICT,
  join_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX idx_games_code ON games(join_code);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_game ON players(game_id);

CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL,
  response_ms INTEGER NOT NULL,
  points_awarded INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, question_id)
);
CREATE INDEX idx_answers_game ON answers(game_id);
```

- [ ] **Step 2: Create the pool singleton**

`db/pool.ts`:

```ts
import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new pg.Pool({ connectionString });
  }
  return pool;
}
```

- [ ] **Step 3: Create the migration runner**

`db/migrate.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "migrations");

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`
    );
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const done = await client.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
      if (done.rowCount) {
        console.log(`skip ${file}`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    }
    console.log("migrations complete");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Provision local databases**

Run (requires Docker; adjust if Postgres already installed):

```bash
docker run -d --name quiz-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
sleep 3
docker exec quiz-pg psql -U postgres -c "CREATE DATABASE quiz;"
docker exec quiz-pg psql -U postgres -c "CREATE DATABASE quiz_test;"
```

Then create a local `.env` from `.env.example` (do not commit it).

- [ ] **Step 5: Apply migrations to both databases**

Run:
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/quiz npm run migrate
DATABASE_URL=postgres://postgres:postgres@localhost:5432/quiz_test npm run migrate
```
Expected: `apply 001_init.sql` then `migrations complete` for each.

- [ ] **Step 6: Commit**

```bash
git add db/
git commit -m "feat: add database schema, pool, and migration runner"
```

---

## Task 7: Repositories — quizzes (TDD, integration)

**Files:**
- Create: `src/server/repositories/quizzes.ts`
- Test: `tests/server/repositories.test.ts` (create; extended in Task 8)

**Interfaces:**
- Consumes: `getPool` (but see note), `QuizInput`, `Quiz`, `QuizSummary`, `QuizForPlay` types.
- Produces:
  - `createQuiz(client, input: QuizInput): Promise<string>` (returns quiz id)
  - `listQuizzes(client): Promise<QuizSummary[]>`
  - `getQuiz(client, id: string): Promise<Quiz | null>` (full, includes is_correct — admin use)
  - `updateQuiz(client, id: string, input: QuizInput): Promise<void>` (replace questions/options)
  - `getQuizForPlay(client, id: string): Promise<Question[]>` (ordered; includes is_correct for server-side scoring)

  All repository functions take a `pg.Pool | pg.PoolClient` as first arg named `db` so tests can pass the test pool. Define a local type `type DB = pg.Pool | pg.PoolClient;`.

- [ ] **Step 1: Write the failing test**

`tests/server/repositories.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { createQuiz, getQuiz, listQuizzes, updateQuiz, getQuizForPlay } from "@/server/repositories/quizzes";

const url = process.env.DATABASE_URL_TEST;
const pool = new pg.Pool({ connectionString: url });

const sampleInput = {
  title: "Geo",
  description: "geography",
  questions: [
    {
      text: "Capital of France?",
      time_limit_seconds: 20,
      points_base: 1000,
      options: [
        { text: "Paris", is_correct: true },
        { text: "London", is_correct: false },
        { text: "Rome", is_correct: false },
        { text: "Berlin", is_correct: false },
      ],
    },
  ],
};

beforeAll(() => {
  if (!url) throw new Error("DATABASE_URL_TEST must be set to run repository tests");
});
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  await pool.query("TRUNCATE answers, players, games, options, questions, quizzes CASCADE");
});

describe("quizzes repository", () => {
  it("creates and reads a full quiz", async () => {
    const id = await createQuiz(pool, sampleInput);
    const quiz = await getQuiz(pool, id);
    expect(quiz?.title).toBe("Geo");
    expect(quiz?.questions).toHaveLength(1);
    expect(quiz?.questions[0].options).toHaveLength(4);
    expect(quiz?.questions[0].options.filter((o) => o.is_correct)).toHaveLength(1);
  });

  it("lists quizzes with a question count", async () => {
    await createQuiz(pool, sampleInput);
    const list = await listQuizzes(pool);
    expect(list).toHaveLength(1);
    expect(list[0].question_count).toBe(1);
  });

  it("returns null for a missing quiz", async () => {
    expect(await getQuiz(pool, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("replaces questions on update", async () => {
    const id = await createQuiz(pool, sampleInput);
    await updateQuiz(pool, id, {
      ...sampleInput,
      title: "Geo2",
      questions: [
        { ...sampleInput.questions[0], text: "Capital of Italy?" },
        { ...sampleInput.questions[0], text: "Capital of Spain?" },
      ],
    });
    const quiz = await getQuiz(pool, id);
    expect(quiz?.title).toBe("Geo2");
    expect(quiz?.questions).toHaveLength(2);
    expect(quiz?.questions[0].text).toBe("Capital of Italy?");
  });

  it("returns ordered questions with correctness for play", async () => {
    const id = await createQuiz(pool, sampleInput);
    const qs = await getQuizForPlay(pool, id);
    expect(qs).toHaveLength(1);
    expect(qs[0].options.some((o) => o.is_correct)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/quiz_test npx vitest run tests/server/repositories.test.ts`
Expected: FAIL — module `@/server/repositories/quizzes` not found.

- [ ] **Step 3: Write minimal implementation**

`src/server/repositories/quizzes.ts`:

```ts
import pg from "pg";
import type { Quiz, Question, QuizSummary, QuizInput } from "@/types";

type DB = pg.Pool | pg.PoolClient;

export async function createQuiz(db: DB, input: QuizInput): Promise<string> {
  const isPool = typeof (db as pg.Pool).connect === "function" && !("release" in db);
  const client = isPool ? await (db as pg.Pool).connect() : (db as pg.PoolClient);
  try {
    await client.query("BEGIN");
    const quiz = await client.query(
      "INSERT INTO quizzes (title, description) VALUES ($1, $2) RETURNING id",
      [input.title.trim(), input.description ?? null]
    );
    const quizId: string = quiz.rows[0].id;
    await insertQuestions(client, quizId, input);
    await client.query("COMMIT");
    return quizId;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    if (isPool) (client as pg.PoolClient).release();
  }
}

async function insertQuestions(client: pg.PoolClient, quizId: string, input: QuizInput) {
  for (let qi = 0; qi < input.questions.length; qi++) {
    const q = input.questions[qi];
    const inserted = await client.query(
      `INSERT INTO questions (quiz_id, text, position, time_limit_seconds, points_base)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [quizId, q.text.trim(), qi, q.time_limit_seconds, q.points_base]
    );
    const questionId: string = inserted.rows[0].id;
    for (let oi = 0; oi < q.options.length; oi++) {
      const o = q.options[oi];
      await client.query(
        `INSERT INTO options (question_id, text, is_correct, position) VALUES ($1, $2, $3, $4)`,
        [questionId, o.text.trim(), o.is_correct, oi]
      );
    }
  }
}

export async function listQuizzes(db: DB): Promise<QuizSummary[]> {
  const res = await db.query(
    `SELECT q.id, q.title, q.description, q.created_at,
            COUNT(qs.id)::int AS question_count
     FROM quizzes q
     LEFT JOIN questions qs ON qs.quiz_id = q.id
     GROUP BY q.id
     ORDER BY q.created_at DESC`
  );
  return res.rows as QuizSummary[];
}

export async function getQuiz(db: DB, id: string): Promise<Quiz | null> {
  const quizRes = await db.query(
    "SELECT id, title, description, created_at FROM quizzes WHERE id = $1",
    [id]
  );
  if (quizRes.rowCount === 0) return null;
  const questions = await loadQuestions(db, id);
  return { ...quizRes.rows[0], questions } as Quiz;
}

async function loadQuestions(db: DB, quizId: string): Promise<Question[]> {
  const qRes = await db.query(
    `SELECT id, quiz_id, text, position, time_limit_seconds, points_base
     FROM questions WHERE quiz_id = $1 ORDER BY position ASC`,
    [quizId]
  );
  const questions: Question[] = [];
  for (const row of qRes.rows) {
    const oRes = await db.query(
      `SELECT id, question_id, text, is_correct, position
       FROM options WHERE question_id = $1 ORDER BY position ASC`,
      [row.id]
    );
    questions.push({ ...row, options: oRes.rows });
  }
  return questions;
}

export async function getQuizForPlay(db: DB, quizId: string): Promise<Question[]> {
  return loadQuestions(db, quizId);
}

export async function updateQuiz(db: DB, id: string, input: QuizInput): Promise<void> {
  const isPool = typeof (db as pg.Pool).connect === "function" && !("release" in db);
  const client = isPool ? await (db as pg.Pool).connect() : (db as pg.PoolClient);
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE quizzes SET title = $1, description = $2 WHERE id = $3",
      [input.title.trim(), input.description ?? null, id]
    );
    await client.query("DELETE FROM questions WHERE quiz_id = $1", [id]);
    await insertQuestions(client, id, input);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    if (isPool) (client as pg.PoolClient).release();
  }
}
```

Note: the `isPool` check distinguishes a `Pool` (has `connect`, no `release`) from a `PoolClient`. Repository read helpers accept either since both expose `.query`.

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/quiz_test npx vitest run tests/server/repositories.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/quizzes.ts tests/server/repositories.test.ts
git commit -m "feat: add quizzes repository with raw SQL"
```

---

## Task 8: Repositories — games, players, answers (TDD, integration)

**Files:**
- Create: `src/server/repositories/games.ts`, `src/server/repositories/players.ts`, `src/server/repositories/answers.ts`
- Modify: `tests/server/repositories.test.ts` (append describe blocks)

**Interfaces:**
- Consumes: quizzes repo `createQuiz`, types.
- Produces:
  - games.ts: `createGame(db, quizId, joinCode): Promise<{ id: string; join_code: string }>`, `getGameByCode(db, code): Promise<{ id: string; quiz_id: string; status: string } | null>`, `setGameStatus(db, gameId, status, endedAt?): Promise<void>`
  - players.ts: `createPlayer(db, gameId, nickname): Promise<{ id: string; nickname: string }>`, `listPlayers(db, gameId): Promise<{ id: string; nickname: string }[]>`, `setPlayerScore(db, playerId, score): Promise<void>`
  - answers.ts: `recordAnswer(db, a: { gameId; playerId; questionId; optionId; isCorrect; responseMs; pointsAwarded }): Promise<void>`

- [ ] **Step 1: Write the failing tests (append to repositories.test.ts)**

```ts
import { createGame, getGameByCode, setGameStatus } from "@/server/repositories/games";
import { createPlayer, listPlayers, setPlayerScore } from "@/server/repositories/players";
import { recordAnswer } from "@/server/repositories/answers";

describe("games/players/answers repositories", () => {
  it("creates and finds a game by code", async () => {
    const quizId = await createQuiz(pool, sampleInput);
    const game = await createGame(pool, quizId, "ABC234");
    const found = await getGameByCode(pool, "ABC234");
    expect(found?.id).toBe(game.id);
    expect(found?.status).toBe("lobby");
  });

  it("updates game status", async () => {
    const quizId = await createQuiz(pool, sampleInput);
    const game = await createGame(pool, quizId, "ABC235");
    await setGameStatus(pool, game.id, "in_progress");
    const found = await getGameByCode(pool, "ABC235");
    expect(found?.status).toBe("in_progress");
  });

  it("creates and lists players, and updates score", async () => {
    const quizId = await createQuiz(pool, sampleInput);
    const game = await createGame(pool, quizId, "ABC236");
    const p = await createPlayer(pool, game.id, "Alex");
    await setPlayerScore(pool, p.id, 740);
    const players = await listPlayers(pool, game.id);
    expect(players.map((x) => x.nickname)).toContain("Alex");
  });

  it("records an answer and enforces one per player/question", async () => {
    const quizId = await createQuiz(pool, sampleInput);
    const quiz = await getQuiz(pool, quizId);
    const q = quiz!.questions[0];
    const correct = q.options.find((o) => o.is_correct)!;
    const game = await createGame(pool, quizId, "ABC237");
    const p = await createPlayer(pool, game.id, "Alex");
    await recordAnswer(pool, {
      gameId: game.id, playerId: p.id, questionId: q.id, optionId: correct.id,
      isCorrect: true, responseMs: 1200, pointsAwarded: 940,
    });
    await expect(
      recordAnswer(pool, {
        gameId: game.id, playerId: p.id, questionId: q.id, optionId: correct.id,
        isCorrect: true, responseMs: 1300, pointsAwarded: 900,
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/quiz_test npx vitest run tests/server/repositories.test.ts`
Expected: FAIL — game/player/answer modules not found.

- [ ] **Step 3: Implement games.ts**

```ts
import pg from "pg";
type DB = pg.Pool | pg.PoolClient;

export async function createGame(db: DB, quizId: string, joinCode: string) {
  const res = await db.query(
    "INSERT INTO games (quiz_id, join_code) VALUES ($1, $2) RETURNING id, join_code",
    [quizId, joinCode]
  );
  return res.rows[0] as { id: string; join_code: string };
}

export async function getGameByCode(db: DB, code: string) {
  const res = await db.query(
    "SELECT id, quiz_id, status FROM games WHERE join_code = $1",
    [code]
  );
  return res.rowCount ? (res.rows[0] as { id: string; quiz_id: string; status: string }) : null;
}

export async function setGameStatus(db: DB, gameId: string, status: string, endedAt?: Date) {
  await db.query(
    "UPDATE games SET status = $1, ended_at = COALESCE($2, ended_at) WHERE id = $3",
    [status, endedAt ?? null, gameId]
  );
}
```

- [ ] **Step 4: Implement players.ts**

```ts
import pg from "pg";
type DB = pg.Pool | pg.PoolClient;

export async function createPlayer(db: DB, gameId: string, nickname: string) {
  const res = await db.query(
    "INSERT INTO players (game_id, nickname) VALUES ($1, $2) RETURNING id, nickname",
    [gameId, nickname]
  );
  return res.rows[0] as { id: string; nickname: string };
}

export async function listPlayers(db: DB, gameId: string) {
  const res = await db.query(
    "SELECT id, nickname FROM players WHERE game_id = $1 ORDER BY joined_at ASC",
    [gameId]
  );
  return res.rows as { id: string; nickname: string }[];
}

export async function setPlayerScore(db: DB, playerId: string, score: number) {
  await db.query("UPDATE players SET score = $1 WHERE id = $2", [score, playerId]);
}
```

- [ ] **Step 5: Implement answers.ts**

```ts
import pg from "pg";
type DB = pg.Pool | pg.PoolClient;

export async function recordAnswer(
  db: DB,
  a: {
    gameId: string; playerId: string; questionId: string; optionId: string;
    isCorrect: boolean; responseMs: number; pointsAwarded: number;
  }
) {
  await db.query(
    `INSERT INTO answers
       (game_id, player_id, question_id, option_id, is_correct, response_ms, points_awarded)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [a.gameId, a.playerId, a.questionId, a.optionId, a.isCorrect, a.responseMs, a.pointsAwarded]
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/quiz_test npx vitest run tests/server/repositories.test.ts`
Expected: PASS (all repository tests).

- [ ] **Step 7: Commit**

```bash
git add src/server/repositories/games.ts src/server/repositories/players.ts src/server/repositories/answers.ts tests/server/repositories.test.ts
git commit -m "feat: add games, players, and answers repositories"
```

---

## Task 9: In-memory game state & game manager (TDD)

**Files:**
- Create: `src/server/gameState.ts`, `src/server/gameManager.ts`
- Test: `tests/server/gameManager.test.ts`

**Interfaces:**
- Consumes: `computeScore` from `@/lib/scoring`, `Question`, `PublicQuestion`, `LeaderboardEntry`, `PlayerResult` types.
- Produces:
  - gameState.ts:
    - `type LivePlayer = { id: string; nickname: string; score: number }`
    - `type LiveGame = { id: string; quizId: string; joinCode: string; questions: Question[]; players: Map<string, LivePlayer>; currentIndex: number; questionStartMs: number | null; answers: Map<string, { optionId: string; isCorrect: boolean; points: number }> /* keyed by playerId, current question only */; status: "lobby" | "in_progress" | "ended" }`
    - `class GameStore { create(game): void; get(id): LiveGame | undefined; getByCode(code): LiveGame | undefined; delete(id): void }`
  - gameManager.ts (pure functions over a `LiveGame`, using an injected `now: () => number` for testable timing):
    - `addPlayer(game, id, nickname): void` (dedupes nickname with numeric suffix)
    - `startQuestion(game, now): PublicQuestion` (advances currentIndex on subsequent calls; sets questionStartMs; clears per-question answers)
    - `submitAnswer(game, playerId, optionId, now): PlayerResult | null` (null if already answered / no active question)
    - `allAnswered(game): boolean`
    - `currentQuestion(game): Question | null`
    - `distribution(game): Record<string, number>`
    - `leaderboard(game): LeaderboardEntry[]`
    - `isLastQuestion(game): boolean`

- [ ] **Step 1: Write the failing test**

`tests/server/gameManager.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Question } from "@/types";
import { GameStore } from "@/server/gameState";
import {
  addPlayer, startQuestion, submitAnswer, allAnswered,
  leaderboard, distribution, isLastQuestion, currentQuestion,
} from "@/server/gameManager";

function makeQuestion(i: number, correctPos: number): Question {
  return {
    id: `q${i}`, quiz_id: "quiz", text: `Q${i}`, position: i,
    time_limit_seconds: 20, points_base: 1000,
    options: [0, 1, 2, 3].map((p) => ({
      id: `q${i}o${p}`, question_id: `q${i}`, text: `opt${p}`,
      is_correct: p === correctPos, position: p,
    })),
  };
}

function makeGame() {
  const store = new GameStore();
  const game = {
    id: "g1", quizId: "quiz", joinCode: "ABC234",
    questions: [makeQuestion(0, 0), makeQuestion(1, 1)],
    players: new Map(), currentIndex: -1, questionStartMs: null,
    answers: new Map(), status: "lobby" as const,
  };
  store.create(game);
  return { store, game };
}

describe("gameManager", () => {
  it("adds players and dedupes nicknames", () => {
    const { game } = makeGame();
    addPlayer(game, "p1", "Alex");
    addPlayer(game, "p2", "Alex");
    const names = [...game.players.values()].map((p) => p.nickname);
    expect(names).toEqual(["Alex", "Alex (2)"]);
  });

  it("starts questions in order", () => {
    const { game } = makeGame();
    const first = startQuestion(game, 1000);
    expect(first.index).toBe(0);
    expect(first.total).toBe(2);
    expect(first.options[0]).not.toHaveProperty("is_correct");
    const second = startQuestion(game, 2000);
    expect(second.index).toBe(1);
  });

  it("scores a correct fast answer and updates leaderboard", () => {
    const { game } = makeGame();
    addPlayer(game, "p1", "Alex");
    startQuestion(game, 1000);
    const res = submitAnswer(game, "p1", "q0o0", 1000); // instant
    expect(res?.is_correct).toBe(true);
    expect(res?.points_awarded).toBe(1000);
    expect(leaderboard(game)[0]).toMatchObject({ player_id: "p1", score: 1000, rank: 1 });
  });

  it("gives 0 for a wrong answer and ignores double-submit", () => {
    const { game } = makeGame();
    addPlayer(game, "p1", "Alex");
    startQuestion(game, 1000);
    const first = submitAnswer(game, "p1", "q0o1", 1000);
    expect(first?.points_awarded).toBe(0);
    const second = submitAnswer(game, "p1", "q0o0", 1000);
    expect(second).toBeNull();
  });

  it("reports allAnswered and distribution", () => {
    const { game } = makeGame();
    addPlayer(game, "p1", "Alex");
    addPlayer(game, "p2", "Sam");
    startQuestion(game, 1000);
    submitAnswer(game, "p1", "q0o0", 1000);
    expect(allAnswered(game)).toBe(false);
    submitAnswer(game, "p2", "q0o1", 1000);
    expect(allAnswered(game)).toBe(true);
    expect(distribution(game)).toMatchObject({ q0o0: 1, q0o1: 1 });
  });

  it("detects the last question", () => {
    const { game } = makeGame();
    startQuestion(game, 1000);
    expect(isLastQuestion(game)).toBe(false);
    startQuestion(game, 2000);
    expect(isLastQuestion(game)).toBe(true);
    expect(currentQuestion(game)?.id).toBe("q1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/gameManager.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement gameState.ts**

```ts
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
```

- [ ] **Step 4: Implement gameManager.ts**

```ts
import { computeScore } from "@/lib/scoring";
import type { LiveGame } from "@/server/gameState";
import type { PublicQuestion, LeaderboardEntry, PlayerResult, Question } from "@/types";

export function addPlayer(game: LiveGame, id: string, nickname: string): void {
  const existing = [...game.players.values()].map((p) => p.nickname);
  let name = nickname.trim() || "Player";
  if (existing.includes(name)) {
    let n = 2;
    while (existing.includes(`${name} (${n})`)) n++;
    name = `${name} (${n})`;
  }
  game.players.set(id, { id, nickname: name, score: 0 });
}

export function currentQuestion(game: LiveGame): Question | null {
  return game.questions[game.currentIndex] ?? null;
}

export function startQuestion(game: LiveGame, now: number): PublicQuestion {
  game.currentIndex += 1;
  game.questionStartMs = now;
  game.answers = new Map();
  const q = game.questions[game.currentIndex];
  return {
    id: q.id,
    text: q.text,
    position: q.position,
    time_limit_seconds: q.time_limit_seconds,
    index: game.currentIndex,
    total: game.questions.length,
    options: q.options
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, text: o.text, position: o.position })),
  };
}

export function submitAnswer(
  game: LiveGame,
  playerId: string,
  optionId: string,
  now: number
): PlayerResult | null {
  const q = currentQuestion(game);
  if (!q || game.questionStartMs === null) return null;
  if (!game.players.has(playerId)) return null;
  if (game.answers.has(playerId)) return null;

  const option = q.options.find((o) => o.id === optionId);
  if (!option) return null;

  const isCorrect = option.is_correct;
  const responseMs = now - game.questionStartMs;
  const points = computeScore({
    isCorrect,
    responseMs,
    timeLimitMs: q.time_limit_seconds * 1000,
    pointsBase: q.points_base,
  });
  game.answers.set(playerId, { optionId, isCorrect, points });
  const player = game.players.get(playerId)!;
  player.score += points;

  const board = leaderboard(game);
  const rank = board.find((e) => e.player_id === playerId)!.rank;
  const correct = q.options.find((o) => o.is_correct)!;
  return {
    is_correct: isCorrect,
    points_awarded: points,
    score: player.score,
    rank,
    correct_option_id: correct.id,
  };
}

export function allAnswered(game: LiveGame): boolean {
  return game.players.size > 0 && game.answers.size >= game.players.size;
}

export function distribution(game: LiveGame): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const a of game.answers.values()) {
    dist[a.optionId] = (dist[a.optionId] ?? 0) + 1;
  }
  return dist;
}

export function leaderboard(game: LiveGame): LeaderboardEntry[] {
  const entries = [...game.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ player_id: p.id, nickname: p.nickname, score: p.score, rank: i + 1 }));
  return entries;
}

export function isLastQuestion(game: LiveGame): boolean {
  return game.currentIndex >= game.questions.length - 1;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/server/gameManager.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/gameState.ts src/server/gameManager.ts tests/server/gameManager.test.ts
git commit -m "feat: add in-memory game state and game manager"
```

---

## Task 10: Admin auth helpers (TDD)

**Files:**
- Create: `src/server/auth.ts`
- Test: `tests/server/auth.test.ts`

**Interfaces:**
- Consumes: env `ADMIN_PASSWORD`, `SESSION_SECRET`.
- Produces:
  - `verifyAdminPassword(password: string): boolean`
  - `signSession(): string` (an HMAC token: `payload.signature`, payload = fixed `"admin"` + issue marker)
  - `verifySession(token: string | undefined): boolean`

  Implementation uses `crypto.createHmac` with `SESSION_SECRET`; no expiry in v1 (stateless admin session). Uses `crypto.timingSafeEqual` for comparisons.

- [ ] **Step 1: Write the failing test**

`tests/server/auth.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { verifyAdminPassword, signSession, verifySession } from "@/server/auth";

beforeAll(() => {
  process.env.ADMIN_PASSWORD = "secret";
  process.env.SESSION_SECRET = "test-secret-value";
});

describe("auth", () => {
  it("verifies the correct admin password", () => {
    expect(verifyAdminPassword("secret")).toBe(true);
    expect(verifyAdminPassword("wrong")).toBe(false);
  });

  it("issues and verifies a session token", () => {
    const token = signSession();
    expect(verifySession(token)).toBe(true);
  });

  it("rejects a tampered or missing token", () => {
    expect(verifySession(undefined)).toBe(false);
    expect(verifySession("bogus.token")).toBe(false);
    const token = signSession();
    expect(verifySession(token + "x")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/server/auth.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not set");
  return safeEqual(password, expected);
}

const PAYLOAD = "admin";

export function signSession(): string {
  const sig = createHmac("sha256", secret()).update(PAYLOAD).digest("hex");
  return `${PAYLOAD}.${sig}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (payload !== PAYLOAD || !sig) return false;
  const expected = createHmac("sha256", secret()).update(PAYLOAD).digest("hex");
  return safeEqual(sig, expected);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/server/auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/auth.ts tests/server/auth.test.ts
git commit -m "feat: add admin password and HMAC session helpers"
```

---

## Task 11: Socket layer & custom server wiring

**Files:**
- Create: `src/server/socket.ts`, `server.ts`
- Test: `tests/server/socket.test.ts`

**Interfaces:**
- Consumes: `GameStore`, gameManager functions, repositories, `generateJoinCode`, `getPool`, types.
- Produces:
  - `registerSocketHandlers(io, deps): void` where `deps = { store: GameStore; db: pg.Pool; getQuizForPlay; createGame; createPlayer; recordAnswer; setPlayerScore; setGameStatus; now: () => number }`. Dependency injection makes the handler testable with a real test DB and a fake clock.
  - `server.ts` builds the Next handler, an HTTP server, a Socket.IO server, and calls `registerSocketHandlers` with real deps.

- [ ] **Step 1: Write the failing integration test**

`tests/server/socket.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { Server as IOServer } from "socket.io";
import { io as ioClient, type Socket } from "socket.io-client";
import pg from "pg";
import { GameStore } from "@/server/gameState";
import { registerSocketHandlers } from "@/server/socket";
import { createQuiz } from "@/server/repositories/quizzes";
import { getQuizForPlay } from "@/server/repositories/quizzes";
import { createGame } from "@/server/repositories/games";
import { createPlayer } from "@/server/repositories/players";
import { recordAnswer } from "@/server/repositories/answers";
import { setPlayerScore } from "@/server/repositories/players";
import { setGameStatus } from "@/server/repositories/games";

const url = process.env.DATABASE_URL_TEST;
const pool = new pg.Pool({ connectionString: url });

const sampleInput = {
  title: "Geo",
  questions: [
    {
      text: "Capital of France?", time_limit_seconds: 20, points_base: 1000,
      options: [
        { text: "Paris", is_correct: true }, { text: "London", is_correct: false },
        { text: "Rome", is_correct: false }, { text: "Berlin", is_correct: false },
      ],
    },
  ],
};

let httpServer: HttpServer;
let io: IOServer;
let port: number;
let now = 0;

beforeAll(async () => {
  if (!url) throw new Error("DATABASE_URL_TEST must be set");
  httpServer = createServer();
  io = new IOServer(httpServer);
  registerSocketHandlers(io, {
    store: new GameStore(), db: pool,
    getQuizForPlay, createGame, createPlayer, recordAnswer, setPlayerScore, setGameStatus,
    now: () => now,
  });
  await new Promise<void>((r) => httpServer.listen(() => r()));
  port = (httpServer.address() as any).port;
});

afterAll(async () => {
  io.close(); httpServer.close(); await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE answers, players, games, options, questions, quizzes CASCADE");
  now = 0;
});

function connect(): Socket {
  return ioClient(`http://localhost:${port}`, { transports: ["websocket"], forceNew: true });
}
function emitAck<T>(s: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((res) => s.emit(event, payload, res));
}
function once<T>(s: Socket, event: string): Promise<T> {
  return new Promise((res) => s.once(event, res));
}

describe("socket flow", () => {
  it("runs a full single-question game", async () => {
    const quizId = await createQuiz(pool, sampleInput);

    const host = connect();
    await once(host, "connect");
    const created = await emitAck<{ gameId: string; joinCode: string }>(
      host, "host:create-game", { quizId }
    );
    expect(created.joinCode).toHaveLength(6);
    host.emit("host:join-room", { gameId: created.gameId });

    const player = connect();
    await once(player, "connect");
    const lobbyPromise = once<{ players: { nickname: string }[] }>(host, "lobby:players");
    const joined = await emitAck<{ playerId: string; gameId: string; nickname: string }>(
      player, "player:join", { joinCode: created.joinCode, nickname: "Alex" }
    );
    expect(joined.nickname).toBe("Alex");
    const lobby = await lobbyPromise;
    expect(lobby.players.map((p) => p.nickname)).toContain("Alex");

    const questionPromise = once<{ id: string; options: { id: string }[] }>(player, "game:question");
    host.emit("host:start", { gameId: created.gameId });
    const question = await questionPromise;
    expect(question.options).toHaveLength(4);

    now = 2000; // 2s to answer
    const resultPromise = once<{ is_correct: boolean; points_awarded: number }>(player, "player:result");
    const overPromise = once<{ leaderboard: { nickname: string; score: number }[] }>(host, "game:over");
    // pick the correct option by matching text via the public question is not possible (no is_correct);
    // the server knows correctness. Submit the first option; then assert result shape.
    player.emit("player:submit", {
      gameId: created.gameId, playerId: joined.playerId, optionId: question.options[0].id,
    });
    const result = await resultPromise;
    expect(typeof result.points_awarded).toBe("number");

    // last question -> game over after all answered
    const over = await overPromise;
    expect(over.leaderboard[0].nickname).toBe("Alex");

    host.close(); player.close();
  });

  it("rejects joining an unknown code", async () => {
    const player = connect();
    await once(player, "connect");
    const res = await emitAck<{ error?: string }>(
      player, "player:join", { joinCode: "ZZZZZZ", nickname: "Alex" }
    );
    expect(res.error).toBeTruthy();
    player.close();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/quiz_test npx vitest run tests/server/socket.test.ts`
Expected: FAIL — module `@/server/socket` not found.

- [ ] **Step 3: Implement socket.ts**

```ts
import type { Server as IOServer } from "socket.io";
import pg from "pg";
import { GameStore, type LiveGame } from "@/server/gameState";
import {
  addPlayer, startQuestion, submitAnswer, allAnswered,
  leaderboard, distribution, isLastQuestion, currentQuestion,
} from "@/server/gameManager";
import { generateJoinCode } from "@/lib/joinCode";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types";

interface Deps {
  store: GameStore;
  db: pg.Pool;
  getQuizForPlay: (db: pg.Pool, quizId: string) => Promise<LiveGame["questions"]>;
  createGame: (db: pg.Pool, quizId: string, code: string) => Promise<{ id: string; join_code: string }>;
  createPlayer: (db: pg.Pool, gameId: string, nickname: string) => Promise<{ id: string; nickname: string }>;
  recordAnswer: (db: pg.Pool, a: {
    gameId: string; playerId: string; questionId: string; optionId: string;
    isCorrect: boolean; responseMs: number; pointsAwarded: number;
  }) => Promise<void>;
  setPlayerScore: (db: pg.Pool, playerId: string, score: number) => Promise<void>;
  setGameStatus: (db: pg.Pool, gameId: string, status: string, endedAt?: Date) => Promise<void>;
  now: () => number;
}

export function registerSocketHandlers(io: IOServer, deps: Deps): void {
  const { store, db, now } = deps;

  function emitAnsweredCount(game: LiveGame) {
    io.to(game.id).emit("game:answered-count", {
      answered: game.answers.size,
      total: game.players.size,
    });
  }

  async function endGame(game: LiveGame) {
    game.status = "ended";
    for (const p of game.players.values()) {
      await deps.setPlayerScore(db, p.id, p.score);
    }
    await deps.setGameStatus(db, game.id, "ended", new Date());
    io.to(game.id).emit("game:over", { leaderboard: leaderboard(game) });
  }

  function revealAndMaybeAdvance(game: LiveGame) {
    const q = currentQuestion(game);
    if (!q) return;
    const correct = q.options.find((o) => o.is_correct)!;
    io.to(game.id).emit("game:question-result", {
      correct_option_id: correct.id,
      distribution: distribution(game),
      leaderboard: leaderboard(game),
    });
  }

  io.on("connection", (socket) => {
    socket.on("host:create-game", async ({ quizId }, ack) => {
      try {
        const questions = await deps.getQuizForPlay(db, quizId);
        if (!questions.length) return ack({ error: "Quiz has no questions" });
        // ensure unique code (retry a few times)
        let code = generateJoinCode();
        let row: { id: string; join_code: string } | null = null;
        for (let i = 0; i < 5 && !row; i++) {
          try { row = await deps.createGame(db, quizId, code); }
          catch { code = generateJoinCode(); }
        }
        if (!row) return ack({ error: "Could not create game" });
        const game: LiveGame = {
          id: row.id, quizId, joinCode: row.join_code, questions,
          players: new Map(), currentIndex: -1, questionStartMs: null,
          answers: new Map(), status: "lobby",
        };
        store.create(game);
        ack({ gameId: game.id, joinCode: game.joinCode });
      } catch {
        ack({ error: "Could not create game" });
      }
    });

    socket.on("host:join-room", ({ gameId }) => { socket.join(gameId); });

    socket.on("player:join", async ({ joinCode, nickname }, ack) => {
      const game = store.getByCode(joinCode.toUpperCase());
      if (!game) return ack({ error: "Game not found" });
      if (game.status !== "lobby") return ack({ error: "Game already started" });
      try {
        const row = await deps.createPlayer(db, game.id, nickname.trim() || "Player");
        addPlayer(game, row.id, nickname);
        const stored = game.players.get(row.id)!;
        socket.join(game.id);
        (socket.data as { playerId?: string; gameId?: string }).playerId = row.id;
        (socket.data as { gameId?: string }).gameId = game.id;
        io.to(game.id).emit("lobby:players", {
          players: [...game.players.values()].map((p) => ({ id: p.id, nickname: p.nickname })),
        });
        ack({ playerId: row.id, gameId: game.id, nickname: stored.nickname });
      } catch {
        ack({ error: "Could not join" });
      }
    });

    socket.on("host:start", async ({ gameId }) => {
      const game = store.get(gameId);
      if (!game || game.status !== "lobby") return;
      game.status = "in_progress";
      await deps.setGameStatus(db, game.id, "in_progress");
      const q = startQuestion(game, now());
      io.to(game.id).emit("game:question", q);
      emitAnsweredCount(game);
    });

    socket.on("host:next", async ({ gameId }) => {
      const game = store.get(gameId);
      if (!game || game.status !== "in_progress") return;
      if (isLastQuestion(game)) { await endGame(game); return; }
      const q = startQuestion(game, now());
      io.to(game.id).emit("game:question", q);
      emitAnsweredCount(game);
    });

    socket.on("player:submit", async ({ gameId, playerId, optionId }) => {
      const game = store.get(gameId);
      if (!game) return;
      const q = currentQuestion(game);
      const result = submitAnswer(game, playerId, optionId, now());
      if (!result || !q) return;
      await deps.recordAnswer(db, {
        gameId: game.id, playerId, questionId: q.id, optionId,
        isCorrect: result.is_correct, responseMs: now() - (game.questionStartMs ?? now()),
        pointsAwarded: result.points_awarded,
      });
      io.to(playerId).emit("player:result", result); // player not in a per-player room; emit directly:
      socket.emit("player:result", result);
      emitAnsweredCount(game);
      if (allAnswered(game)) {
        revealAndMaybeAdvance(game);
        if (isLastQuestion(game)) await endGame(game);
      }
    });

    socket.on("player:resync", ({ gameId, playerId }) => {
      const game = store.get(gameId);
      if (!game) return;
      socket.join(game.id);
      if (game.status === "in_progress") {
        const q = currentQuestion(game);
        if (q && game.questionStartMs !== null) {
          const elapsed = now() - game.questionStartMs;
          const remaining = Math.max(0, q.time_limit_seconds * 1000 - elapsed);
          socket.emit("game:question", {
            id: q.id, text: q.text, position: q.position,
            time_limit_seconds: Math.ceil(remaining / 1000),
            index: game.currentIndex, total: game.questions.length,
            options: q.options.slice().sort((a, b) => a.position - b.position)
              .map((o) => ({ id: o.id, text: o.text, position: o.position })),
          });
        }
      } else if (game.status === "ended") {
        socket.emit("game:over", { leaderboard: leaderboard(game) });
      }
    });
  });
}
```

Note: the `io.to(playerId)` line is redundant with the direct `socket.emit` (players are not joined to a per-player room in v1); keep only `socket.emit("player:result", result)` and delete the `io.to(playerId)` line when implementing.

- [ ] **Step 4: Implement server.ts**

```ts
import { createServer } from "node:http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { GameStore } from "@/server/gameState";
import { registerSocketHandlers } from "@/server/socket";
import { getPool } from "../db/pool";
import { getQuizForPlay } from "@/server/repositories/quizzes";
import { createGame, setGameStatus } from "@/server/repositories/games";
import { createPlayer, setPlayerScore } from "@/server/repositories/players";
import { recordAnswer } from "@/server/repositories/answers";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new IOServer(httpServer);
  registerSocketHandlers(io, {
    store: new GameStore(),
    db: getPool(),
    getQuizForPlay, createGame, createPlayer, recordAnswer, setPlayerScore, setGameStatus,
    now: () => Date.now(),
  });
  httpServer.listen(port, () => console.log(`> ready on http://localhost:${port}`));
});
```

- [ ] **Step 5: Apply the note fix**

In `src/server/socket.ts`, delete the redundant line `io.to(playerId).emit("player:result", result);` leaving only `socket.emit("player:result", result);`.

- [ ] **Step 6: Run to verify it passes**

Run: `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/quiz_test npx vitest run tests/server/socket.test.ts`
Expected: PASS (2 tests). If the "runs a full single-question game" test's `game:over` wait times out because the submitted option was wrong (0 players fully advance), note: with a single player, `allAnswered` is true after one submit regardless of correctness, so reveal + endGame fire. Test should pass.

- [ ] **Step 7: Commit**

```bash
git add src/server/socket.ts server.ts
git commit -m "feat: add Socket.IO game handlers and custom server"
```

---

## Task 12: Admin REST API (auth + quiz CRUD)

**Files:**
- Create: `src/app/api/admin/login/route.ts`, `src/app/api/admin/quizzes/route.ts`, `src/app/api/admin/quizzes/[id]/route.ts`
- Test: manual (Next route handlers; covered by unit-tested `validation`, `auth`, and repositories)

**Interfaces:**
- Consumes: `verifyAdminPassword`, `signSession`, `verifySession`, `validateQuizInput`, quizzes repo, `getPool`.
- Produces: HTTP endpoints:
  - `POST /api/admin/login` `{ password }` → sets `admin_session` httpOnly cookie or 401.
  - `GET /api/admin/quizzes` → `QuizSummary[]` (auth required).
  - `POST /api/admin/quizzes` `QuizInput` → `{ id }` (auth + validation).
  - `GET /api/admin/quizzes/:id` → `Quiz` (auth).
  - `PUT /api/admin/quizzes/:id` `QuizInput` → `{ ok: true }` (auth + validation).

- [ ] **Step 1: Implement the login route**

`src/app/api/admin/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { verifyAdminPassword, signSession } from "@/server/auth";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_session", signSession(), {
    httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production",
  });
  return res;
}
```

- [ ] **Step 2: Add an auth guard helper and quizzes collection route**

`src/app/api/admin/quizzes/route.ts`:

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/server/auth";
import { validateQuizInput } from "@/lib/validation";
import { getPool } from "../../../../../db/pool";
import { listQuizzes, createQuiz } from "@/server/repositories/quizzes";

function authed(): boolean {
  return verifySession(cookies().get("admin_session")?.value);
}

export async function GET() {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listQuizzes(getPool()));
}

export async function POST(req: Request) {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const check = validateQuizInput(body);
  if (!check.valid) return NextResponse.json({ errors: check.errors }, { status: 400 });
  const id = await createQuiz(getPool(), body);
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 3: Implement the single-quiz route**

`src/app/api/admin/quizzes/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/server/auth";
import { validateQuizInput } from "@/lib/validation";
import { getPool } from "../../../../../../db/pool";
import { getQuiz, updateQuiz } from "@/server/repositories/quizzes";

function authed(): boolean {
  return verifySession(cookies().get("admin_session")?.value);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const quiz = await getQuiz(getPool(), params.id);
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quiz);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const check = validateQuizInput(body);
  if (!check.valid) return NextResponse.json({ errors: check.errors }, { status: 400 });
  await updateQuiz(getPool(), params.id, body);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Start dev server (`npm run dev` with a local `.env`), then:
```bash
curl -i -X POST localhost:3000/api/admin/login -H 'content-type: application/json' -d '{"password":"change-me"}' -c cookies.txt
curl -s localhost:3000/api/admin/quizzes -b cookies.txt
curl -s -X POST localhost:3000/api/admin/quizzes -b cookies.txt -H 'content-type: application/json' \
  -d '{"title":"Geo","questions":[{"text":"Capital of France?","time_limit_seconds":20,"points_base":1000,"options":[{"text":"Paris","is_correct":true},{"text":"London","is_correct":false},{"text":"Rome","is_correct":false},{"text":"Berlin","is_correct":false}]}]}'
```
Expected: login sets cookie (200), list returns `[]` then the created quiz id (201).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin
git commit -m "feat: add admin auth and quiz CRUD API"
```

---

## Task 13: Admin UI (login, quiz list, quiz editor)

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/quiz/[id]/page.tsx`

**Interfaces:**
- Consumes: the admin API endpoints from Task 12.
- Produces: client pages for authoring. All are `"use client"` components using `fetch` with `credentials: "include"`.

- [ ] **Step 1: Implement the admin landing (login + list + new quiz)**

`src/app/admin/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Implement the quiz editor**

`src/app/admin/quiz/[id]/page.tsx`:

```tsx
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

With `npm run dev` running: open `/admin`, log in, create a quiz, edit questions/options, mark a correct answer, save. Confirm "Saved" and that reloading shows persisted values.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin
git commit -m "feat: add admin login, quiz list, and quiz editor UI"
```

---

## Task 14: Shared UI components

**Files:**
- Create: `src/components/AnswerButton.tsx`, `src/components/Countdown.tsx`, `src/components/Leaderboard.tsx`

**Interfaces:**
- Consumes: `LeaderboardEntry` type.
- Produces:
  - `AnswerButton({ index, text, onClick, disabled, dimmed })` — colored/shaped button (index 0–3 maps to red/blue/yellow/green + ▲◆●■).
  - `Countdown({ seconds, keySeed })` — counts down from `seconds`; restarts when `keySeed` changes.
  - `Leaderboard({ entries, highlightId })` — ordered list.

- [ ] **Step 1: Implement AnswerButton**

`src/components/AnswerButton.tsx`:

```tsx
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
```

- [ ] **Step 2: Implement Countdown**

`src/components/Countdown.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";

export function Countdown({ seconds, keySeed }: { seconds: number; keySeed: string | number }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    setRemaining(seconds);
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [seconds, keySeed]);
  return <div style={{ fontSize: 48, fontWeight: 700 }}>{remaining}</div>;
}
```

- [ ] **Step 3: Implement Leaderboard**

`src/components/Leaderboard.tsx`:

```tsx
import type { LeaderboardEntry } from "@/types";

export function Leaderboard({ entries, highlightId }: { entries: LeaderboardEntry[]; highlightId?: string }) {
  return (
    <ol style={{ listStyle: "none", padding: 0 }}>
      {entries.map((e) => (
        <li key={e.player_id}
          style={{
            display: "flex", justifyContent: "space-between", padding: "10px 14px",
            marginBottom: 6, borderRadius: 8,
            background: e.player_id === highlightId ? "var(--blue)" : "#2a2b47",
          }}>
          <span>{e.rank}. {e.nickname}</span>
          <span>{e.score}</span>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat: add answer button, countdown, and leaderboard components"
```

---

## Task 15: Player UI (join + play)

**Files:**
- Create: `src/app/join/page.tsx`, `src/app/play/page.tsx`
- Create: `src/lib/socketClient.ts` (browser Socket.IO singleton)

**Interfaces:**
- Consumes: socket events (`ServerToClientEvents`/`ClientToServerEvents`), `AnswerButton`, `Countdown`.
- Produces: player join flow (writes `playerId`/`gameId`/`nickname` to `sessionStorage`, then navigates to `/play`) and the live play screen.

- [ ] **Step 1: Implement the browser socket singleton**

`src/lib/socketClient.ts`:

```ts
"use client";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) socket = io({ transports: ["websocket"] });
  return socket;
}
```

- [ ] **Step 2: Implement the join page**

`src/app/join/page.tsx`:

```tsx
"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socketClient";

function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  function join(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const socket = getSocket();
    socket.emit("player:join", { joinCode: code.toUpperCase(), nickname }, (res) => {
      if ("error" in res) { setError(res.error); return; }
      sessionStorage.setItem("playerId", res.playerId);
      sessionStorage.setItem("gameId", res.gameId);
      sessionStorage.setItem("nickname", res.nickname);
      router.push("/play");
    });
  }

  return (
    <main className="container">
      <h1>Join the game</h1>
      <form onSubmit={join} className="card">
        <input placeholder="Game code" value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} />
        <input placeholder="Your name" value={nickname}
          onChange={(e) => setNickname(e.target.value)} style={{ marginTop: 8 }} />
        {error && <p style={{ color: "var(--red)" }}>{error}</p>}
        <button type="submit" style={{ marginTop: 12 }}>Enter</button>
      </form>
    </main>
  );
}

export default function JoinPage() {
  return <Suspense><JoinInner /></Suspense>;
}
```

- [ ] **Step 3: Implement the play page**

`src/app/play/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socketClient";
import { AnswerButton } from "@/components/AnswerButton";
import { Countdown } from "@/components/Countdown";
import type { PublicQuestion, PlayerResult, LeaderboardEntry } from "@/types";

type Phase = "waiting" | "question" | "answered" | "result" | "over";

export default function PlayPage() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [result, setResult] = useState<PlayerResult | null>(null);
  const [finalBoard, setFinalBoard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const gameId = sessionStorage.getItem("gameId");
    const playerId = sessionStorage.getItem("playerId");
    if (gameId && playerId) socket.emit("player:resync", { gameId, playerId });

    socket.on("game:question", (q) => { setQuestion(q); setResult(null); setPhase("question"); });
    socket.on("player:result", (r) => { setResult(r); });
    socket.on("game:question-result", () => { setPhase("result"); });
    socket.on("game:over", ({ leaderboard }) => { setFinalBoard(leaderboard); setPhase("over"); });

    return () => {
      socket.off("game:question"); socket.off("player:result");
      socket.off("game:question-result"); socket.off("game:over");
    };
  }, []);

  function submit(optionId: string) {
    const socket = getSocket();
    const gameId = sessionStorage.getItem("gameId")!;
    const playerId = sessionStorage.getItem("playerId")!;
    socket.emit("player:submit", { gameId, playerId, optionId });
    setPhase("answered");
  }

  if (phase === "waiting")
    return <main className="container"><h1>You're in!</h1><p>Waiting for the host to start…</p></main>;

  if (phase === "over") {
    const me = sessionStorage.getItem("playerId");
    const mine = finalBoard.find((e) => e.player_id === me);
    return (
      <main className="container">
        <h1>Game over</h1>
        {mine && <p>You finished #{mine.rank} with {mine.score} points.</p>}
      </main>
    );
  }

  if ((phase === "result" || phase === "answered") && result) {
    return (
      <main className="container">
        <h1>{result.is_correct ? "Correct!" : "Wrong"}</h1>
        <p>+{result.points_awarded} points — rank #{result.rank}</p>
      </main>
    );
  }

  if (phase === "answered")
    return <main className="container"><h1>Answer locked</h1><p>Waiting for others…</p></main>;

  if (phase === "question" && question)
    return (
      <main className="container">
        <Countdown seconds={question.time_limit_seconds} keySeed={question.id} />
        <p>Question {question.index + 1} of {question.total}</p>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {question.options.map((o, i) => (
            <AnswerButton key={o.id} index={i} text={o.text} onClick={() => submit(o.id)} />
          ))}
        </div>
      </main>
    );

  return <main className="container"><p>Loading…</p></main>;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification (deferred to Task 16 end-to-end run).**

- [ ] **Step 6: Commit**

```bash
git add src/app/join src/app/play src/lib/socketClient.ts
git commit -m "feat: add player join and play screens"
```

---

## Task 16: Presenter UI (host) + end-to-end verification

**Files:**
- Create: `src/app/host/page.tsx`

**Interfaces:**
- Consumes: admin quiz list API (to pick a quiz), socket events, `qrcode`, `Leaderboard`, `Countdown`.
- Produces: the presenter screen (lobby with code/QR, live question with answered count, per-question distribution + leaderboard, podium).

- [ ] **Step 1: Implement the host page**

`src/app/host/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getSocket } from "@/lib/socketClient";
import { Leaderboard } from "@/components/Leaderboard";
import { Countdown } from "@/components/Countdown";
import type { PublicQuestion, LeaderboardEntry } from "@/types";

interface Summary { id: string; title: string; question_count: number; }
type Phase = "pick" | "lobby" | "question" | "result" | "over";

export default function HostPage() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [quizzes, setQuizzes] = useState<Summary[]>([]);
  const [gameId, setGameId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [qr, setQr] = useState("");
  const [players, setPlayers] = useState<{ id: string; nickname: string }[]>([]);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [answered, setAnswered] = useState({ answered: 0, total: 0 });
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [distribution, setDistribution] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/quizzes", { credentials: "include" });
      if (res.ok) setQuizzes(await res.json());
    })();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.on("lobby:players", ({ players }) => setPlayers(players));
    socket.on("game:question", (q) => { setQuestion(q); setDistribution({}); setPhase("question"); });
    socket.on("game:answered-count", (c) => setAnswered(c));
    socket.on("game:question-result", (r) => {
      setDistribution(r.distribution); setBoard(r.leaderboard); setPhase("result");
    });
    socket.on("game:over", ({ leaderboard }) => { setBoard(leaderboard); setPhase("over"); });
    return () => {
      socket.off("lobby:players"); socket.off("game:question");
      socket.off("game:answered-count"); socket.off("game:question-result"); socket.off("game:over");
    };
  }, []);

  async function createGame(quizId: string) {
    const socket = getSocket();
    socket.emit("host:create-game", { quizId }, async (res) => {
      if ("error" in res) { alert(res.error); return; }
      setGameId(res.gameId);
      setJoinCode(res.joinCode);
      socket.emit("host:join-room", { gameId: res.gameId });
      const url = `${window.location.origin}/join?code=${res.joinCode}`;
      setQr(await QRCode.toDataURL(url));
      setPhase("lobby");
    });
  }
  function start() { getSocket().emit("host:start", { gameId }); }
  function next() { getSocket().emit("host:next", { gameId }); }

  if (phase === "pick")
    return (
      <main className="container">
        <h1>Host a game</h1>
        <p>Pick a quiz (log in at <a href="/admin">/admin</a> first if the list is empty):</p>
        <ul>
          {quizzes.map((q) => (
            <li key={q.id}>
              <button onClick={() => createGame(q.id)}>{q.title} ({q.question_count} q)</button>
            </li>
          ))}
        </ul>
      </main>
    );

  if (phase === "lobby")
    return (
      <main className="container">
        <h1>Join at {window.location.host}/join</h1>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: 4 }}>{joinCode}</div>
        {qr && <img src={qr} alt="Join QR" width={220} height={220} />}
        <h2>Players ({players.length})</h2>
        <ul>{players.map((p) => <li key={p.id}>{p.nickname}</li>)}</ul>
        <button onClick={start} disabled={players.length === 0}>Start</button>
      </main>
    );

  if (phase === "question" && question)
    return (
      <main className="container">
        <Countdown seconds={question.time_limit_seconds} keySeed={question.id} />
        <h1>{question.text}</h1>
        <p>{answered.answered} / {answered.total} answered</p>
        <ol>{question.options.map((o) => <li key={o.id}>{o.text}</li>)}</ol>
      </main>
    );

  if (phase === "result" && question)
    return (
      <main className="container">
        <h1>Results</h1>
        <ul>
          {question.options.map((o) => (
            <li key={o.id}>{o.text}: {distribution[o.id] ?? 0}</li>
          ))}
        </ul>
        <h2>Leaderboard</h2>
        <Leaderboard entries={board.slice(0, 5)} />
        <button onClick={next}>Next</button>
      </main>
    );

  if (phase === "over")
    return (
      <main className="container">
        <h1>Final results</h1>
        <Leaderboard entries={board.slice(0, 5)} />
      </main>
    );

  return <main className="container"><p>Loading…</p></main>;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/quiz_test npx vitest run`
Expected: all tests pass.

- [ ] **Step 4: End-to-end manual verification**

With `npm run dev` and a local `.env`:
1. `/admin` → log in → create a quiz with 2 questions → save.
2. `/host` → pick the quiz → lobby shows code + QR.
3. On a phone or second browser, open `/join?code=CODE` (or scan QR) → enter a name → land on "waiting".
4. Host clicks **Start** → player sees the question + 4 colored buttons + countdown.
5. Player answers → host's answered count increments; when all answered (or timer), host sees distribution + leaderboard.
6. Host clicks **Next** through to the end → both see final leaderboard; player sees personal rank.

Confirm each step. Fix any wiring issues before committing.

- [ ] **Step 5: Commit**

```bash
git add src/app/host
git commit -m "feat: add presenter host screen and complete end-to-end flow"
```

---

## Task 17: README & deployment notes

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: setup/run/deploy documentation.

- [ ] **Step 1: Write README.md**

Include: prerequisites (Node 20+, Postgres), env vars (from `.env.example`), local setup (`npm install`, create DBs, `npm run migrate`, `npm run dev`), test instructions (set `DATABASE_URL_TEST`, `npm test`), the three surfaces (`/admin`, `/host`, `/join`), scoring/`SPEED_FACTOR` note, and a deployment note: deploy on a Node host (Railway/Render/Fly/VPS) — NOT Vercel serverless — because Socket.IO needs a persistent process; run `npm run build` then `npm start`; serve under the `quiz` subdomain; set all env vars; run `npm run migrate` against the production DB on deploy.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup and deployment README"
```

---

## Self-Review Notes

- **Spec coverage:** Live sync flow (Tasks 9, 11, 15, 16); admin authoring (Tasks 12, 13); 4-options/1-correct invariant (Task 5 validation + Task 12 enforcement); Kahoot scoring with SPEED_FACTOR (Task 3); join code + QR (Tasks 4, 16); data model (Task 6); in-memory live state + persistence (Tasks 9, 11); reconnection (`player:resync` in Task 11, used in Task 15); duplicate nickname suffix (Task 9); no mid-game joins (Task 11 `player:join` status check); first-answer-wins (Task 9 `submitAnswer` + DB unique constraint Task 6); admin shared-password auth (Task 10, 12). All spec sections map to a task.
- **Testing:** unit tests for scoring/join-code/validation/auth (Tasks 3,4,5,10); integration tests for repositories (Tasks 7,8) and the socket flow lobby→question→result→over (Task 11); manual E2E (Task 16).
- **Type consistency:** socket event names and payloads are defined once in `src/types/index.ts` (Task 2) and reused verbatim by the socket layer, client singleton, and UI. Repository signatures use a shared `DB` type and are consumed by the socket `Deps` interface with matching shapes.
