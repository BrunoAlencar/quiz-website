# Dashboard, Tick Sound, Full Ranking and Longer Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every participant on the host's final screen, add an admin dashboard over past games, tick during the host countdown, and give every question 10 more seconds.

**Architecture:** Read-only SQL in a new `stats` repository feeds three admin API routes and one client page. The tick is a Web Audio blip triggered from the shared `Countdown` component, enabled only by the host page. The timer change is a SQL migration plus new defaults.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, `pg`, Vitest against a Postgres test database (`DATABASE_URL_TEST`).

**Spec:** `docs/superpowers/specs/2026-10-04-dashboard-sound-full-ranking-design.md`

## Global Constraints

- No new dependencies (no chart or audio libraries, no audio files).
- Only games with `status = 'ended'` count in any dashboard number.
- Dashboard routes use the existing `admin_session` cookie check and return 401 otherwise.
- Sound must never break the game: all audio code is wrapped in try/catch.
- Phones stay silent; only the host page enables the tick.
- Commits are not part of this plan; the user commits when ready.

---

### Task 1: Ten more seconds

**Files:**
- Create: `db/migrations/002_time_limit_plus_10.sql`
- Modify: `db/seed-general-knowledge.ts`, `db/seed-kafka-partitions.ts`, `db/seed-styleguide.ts` (`time_limit_seconds: 20` → `30`)
- Modify: `src/app/admin/page.tsx`, `src/app/admin/quiz/[id]/page.tsx` (new-question default `20` → `30`)

- [ ] **Step 1: Write the migration**

```sql
-- Give every question 10 more seconds and make 30s the default for new ones.
UPDATE questions SET time_limit_seconds = time_limit_seconds + 10;
ALTER TABLE questions ALTER COLUMN time_limit_seconds SET DEFAULT 30;
```

- [ ] **Step 2: Change the defaults** — replace `time_limit_seconds: 20` with `time_limit_seconds: 30` in the five files above (tests keep their own explicit 20).

- [ ] **Step 3: Apply and verify**

Run: `npm run migrate`, then `DATABASE_URL=$DATABASE_URL_TEST npm run migrate`
Expected: `apply 002_time_limit_plus_10.sql`; `SELECT DISTINCT time_limit_seconds FROM questions` on the dev DB shows 30 for previously-20 questions.

---

### Task 2: Stats repository

**Files:**
- Modify: `src/types/index.ts` (add three interfaces)
- Create: `src/server/repositories/stats.ts`
- Test: `tests/server/stats.test.ts`

**Interfaces:**
- Produces:
  - `getOverview(db): Promise<DashboardOverview>`
  - `listPastGames(db, limit = 100): Promise<PastGame[]>`
  - `getGameRanking(db, gameId): Promise<LeaderboardEntry[]>`
  - `getQuestionStats(db, quizId): Promise<QuestionStat[]>`

- [ ] **Step 1: Add types** to `src/types/index.ts` after `PlayerResult`:

```ts
// ---- Admin dashboard (ended games only) ----

export interface DashboardOverview {
  games_played: number;
  participants: number;
  accuracy_pct: number | null; // correct answers / answers given
  top_quiz_title: string | null;
}

export interface PastGame {
  id: string;
  quiz_id: string;
  quiz_title: string;
  ended_at: string;
  player_count: number;
  winner_nickname: string | null;
  winner_score: number | null;
}

export interface QuestionStat {
  question_id: string;
  text: string;
  position: number;
  answers: number;
  correct: number;
  correct_pct: number | null;
  avg_response_ms: number | null;
}
```

- [ ] **Step 2: Write the failing tests** — `tests/server/stats.test.ts`. Fixture: quiz A (3 questions) with ended games G1 (Ana 900: correct, correct, none; Bia 400: correct, wrong, none; ended 2026-01-01) and G2 (Caio 500: correct; ended 2026-01-03); quiz B with ended G3 (Duda 100: wrong; ended 2026-01-02) and unfinished G4 (Eva: three correct). Correct answers take 2000 ms, wrong ones 4000 ms. Cases:
  - empty database → `{0, 0, null, null}` and `[]`
  - overview → 3 games, 4 participants, 67% accuracy, top quiz "Quiz A"
  - past games → order G2, G3, G1; G1 has 2 players and winner Ana 900; `limit` respected
  - ranking → Ana #1, Bia #2; tie broken by join order; unknown game → `[]`
  - question stats for A → order Q2 (50%, 3000 ms, 2 answers), Q1 (100%, 3 answers), Q3 (nulls); for B → Q1 has 1 answer, 0%

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/server/stats.test.ts`
Expected: FAIL, cannot resolve `@/server/repositories/stats`.

- [ ] **Step 4: Implement `src/server/repositories/stats.ts`**

```ts
import pg from "pg";
import type { DashboardOverview, PastGame, QuestionStat, LeaderboardEntry } from "@/types";

type DB = pg.Pool | pg.PoolClient;

export async function getOverview(db: DB): Promise<DashboardOverview> {
  const res = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM games WHERE status = 'ended') AS games_played,
       (SELECT COUNT(*)::int FROM players p
          JOIN games g ON g.id = p.game_id WHERE g.status = 'ended') AS participants,
       (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE a.is_correct) / NULLIF(COUNT(*), 0))::int
          FROM answers a JOIN games g ON g.id = a.game_id WHERE g.status = 'ended') AS accuracy_pct,
       (SELECT q.title FROM games g JOIN quizzes q ON q.id = g.quiz_id
          WHERE g.status = 'ended'
          GROUP BY q.id
          ORDER BY COUNT(*) DESC, MAX(g.ended_at) DESC
          LIMIT 1) AS top_quiz_title`
  );
  return res.rows[0] as DashboardOverview;
}

export async function listPastGames(db: DB, limit = 100): Promise<PastGame[]> {
  const res = await db.query(
    `SELECT g.id, g.quiz_id, q.title AS quiz_title, g.ended_at,
            (SELECT COUNT(*)::int FROM players p WHERE p.game_id = g.id) AS player_count,
            w.nickname AS winner_nickname, w.score AS winner_score
     FROM games g
     JOIN quizzes q ON q.id = g.quiz_id
     LEFT JOIN LATERAL (
       SELECT nickname, score FROM players p
       WHERE p.game_id = g.id
       ORDER BY score DESC, joined_at ASC, id ASC
       LIMIT 1
     ) w ON true
     WHERE g.status = 'ended'
     ORDER BY g.ended_at DESC NULLS LAST, g.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows as PastGame[];
}

export async function getGameRanking(db: DB, gameId: string): Promise<LeaderboardEntry[]> {
  const res = await db.query(
    `SELECT id AS player_id, nickname, score,
            (ROW_NUMBER() OVER (ORDER BY score DESC, joined_at ASC, id ASC))::int AS rank
     FROM players WHERE game_id = $1
     ORDER BY rank`,
    [gameId]
  );
  return res.rows as LeaderboardEntry[];
}

/** Per-question accuracy for a quiz, hardest first; unanswered questions last. */
export async function getQuestionStats(db: DB, quizId: string): Promise<QuestionStat[]> {
  const res = await db.query(
    `SELECT qs.id AS question_id, qs.text, qs.position,
            COUNT(a.id)::int AS answers,
            (COUNT(a.id) FILTER (WHERE a.is_correct))::int AS correct,
            ROUND(100.0 * COUNT(a.id) FILTER (WHERE a.is_correct) / NULLIF(COUNT(a.id), 0))::int AS correct_pct,
            ROUND(AVG(a.response_ms))::int AS avg_response_ms
     FROM questions qs
     LEFT JOIN (
       SELECT a.id, a.question_id, a.is_correct, a.response_ms
       FROM answers a JOIN games g ON g.id = a.game_id
       WHERE g.status = 'ended'
     ) a ON a.question_id = qs.id
     WHERE qs.quiz_id = $1
     GROUP BY qs.id
     ORDER BY correct_pct ASC NULLS LAST, qs.position ASC`,
    [quizId]
  );
  return res.rows as QuestionStat[];
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/server/stats.test.ts`
Expected: all tests PASS.

---

### Task 3: Dashboard API routes

**Files:**
- Create: `src/app/api/admin/dashboard/route.ts` → `{ overview, games }`
- Create: `src/app/api/admin/games/[id]/route.ts` → `{ ranking }`
- Create: `src/app/api/admin/quizzes/[id]/stats/route.ts` → `{ questions }`

**Interfaces:**
- Consumes: the four functions from Task 2; `verifySession`; `getPool` from `db/pool`.

- [ ] **Step 1: Write the three routes.** Each starts with the same guard used in `src/app/api/admin/quizzes/route.ts`:

```ts
function authed(): boolean {
  return verifySession(cookies().get("admin_session")?.value);
}
```

`dashboard/route.ts`:

```ts
export async function GET() {
  if (!authed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pool = getPool();
  const [overview, games] = await Promise.all([getOverview(pool), listPastGames(pool)]);
  return NextResponse.json({ overview, games });
}
```

`games/[id]/route.ts` and `quizzes/[id]/stats/route.ts` validate the id with
`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` (404 `Not found`
otherwise, so a malformed id never reaches Postgres as a failed uuid cast) and
return `{ ranking: await getGameRanking(getPool(), params.id) }` and
`{ questions: await getQuestionStats(getPool(), params.id) }` respectively.

- [ ] **Step 2: Verify** with the dev server: unauthenticated `curl -i localhost:3000/api/admin/dashboard` returns 401; after login the three routes return JSON.

---

### Task 4: Dashboard page

**Files:**
- Create: `src/app/admin/dashboard/page.tsx`
- Modify: `src/app/admin/page.tsx` (add a "Dashboard" link beside "New quiz")
- Modify: `src/app/globals.css` (stat tiles, game rows, difficulty bars)

**Interfaces:**
- Consumes: `GET /api/admin/dashboard`, `GET /api/admin/games/[id]`, `GET /api/admin/quizzes/[id]/stats`; `Leaderboard` component.

- [ ] **Step 1: Build the page** — client component with:
  - load states `loading | ready | unauthorized | error`; `unauthorized` shows a link to `/admin`
  - Overview: four `.stat` tiles (Games played, Participants, Average accuracy, Most played quiz; `–` for null)
  - Game history: one `<button className="quiz-item game-row" aria-expanded>` per game showing quiz title and `date · N players · winner (score)`; expanding fetches the ranking once (cached per game id) and renders `<Leaderboard>`; empty state "No finished games yet."
  - Question difficulty (hidden when there are no games): `<select>` of the distinct quizzes found in `games`, defaulting to the first; rows with question text, `.bar` filled to `correct_pct`, and `N answers · X.Xs avg`; a note that stats cover games played since the quiz was last saved
  - per-section inline `.error` on a failed fetch

- [ ] **Step 2: Add CSS**

```css
/* ---- Admin dashboard ---- */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.stat { padding: 16px 18px; border: 1px solid var(--line); border-radius: 14px; background: #181a30; min-width: 0; }
.stat small { display: block; color: var(--muted); font-weight: 600; margin-bottom: 6px; }
.stat b { font-size: 1.7rem; font-weight: 800; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.stat b.is-text { font-size: 1.1rem; }
.game-row { flex-wrap: wrap; }
.game-detail { padding: 4px 0 8px; }
.qstat { display: grid; gap: 8px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: #181a30; }
.qstat-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 650; }
.qstat-head span:first-child { min-width: 0; overflow-wrap: anywhere; }
.qstat-head .pct { flex: none; font-weight: 800; font-variant-numeric: tabular-nums; }
.bar { height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; }
.bar > i { display: block; height: 100%; border-radius: inherit; background: var(--green); }
.qstat small { color: var(--muted); }
```

- [ ] **Step 3: Link it** from `/admin`: wrap "New quiz" in `.btn-row` with `<Link className="btn" href="/admin/dashboard">Dashboard</Link>`.

- [ ] **Step 4: Verify** in the browser with real data (play one game first).

---

### Task 5: Tick sound

**Files:**
- Create: `src/lib/tickSound.ts`
- Modify: `src/components/Countdown.tsx` (optional `sound` prop)
- Modify: `src/app/host/page.tsx` (mute state, toggle button, `sound={!muted}`)
- Modify: `src/app/globals.css` (`.timer-group`)

**Interfaces:**
- Produces: `playTick(urgent: boolean): void`; `Countdown` prop `sound?: boolean`.

- [ ] **Step 1: `src/lib/tickSound.ts`**

```ts
let ctx: AudioContext | null = null;

/** Short synthesized countdown tick. Never throws: sound must not break a game. */
export function playTick(urgent: boolean): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = urgent ? 1200 : 800;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  } catch {
    // no audio available
  }
}
```

- [ ] **Step 2: `Countdown`** — keep the latest `sound` in a ref; in the interval, decrement a local counter, set state, and call `playTick(left <= 5)` when `left > 0` and sound is on.

- [ ] **Step 3: Host page** — `muted` state read from `localStorage["quiz:muted"]` in an effect (try/catch), a toggle button (`aria-pressed`, label "Mute tick sound" / "Unmute tick sound") next to the timer inside `.timer-group`, and `<Countdown sound={!muted} … />`.

- [ ] **Step 4: Verify** in the browser: ticks each second, higher pitch for the last 5, silent when muted, mute survives reload, phone page silent.

---

### Task 6: Full final ranking

**Files:**
- Modify: `src/app/host/page.tsx` (phase `over`)
- Modify: `src/app/globals.css` (`.board-scroll`)

- [ ] **Step 1:** In the `over` phase render

```tsx
<p className="muted">{board.length} players</p>
<div className="board-scroll"><Leaderboard entries={board} /></div>
```

with `.board-scroll { width: 100%; max-height: 60dvh; overflow-y: auto; padding: 2px; }`. The `result` phase keeps `board.slice(0, 5)`.

- [ ] **Step 2: Verify** with more than five players that all appear and the list scrolls.

---

### Task 7: Full verification

- [ ] Run `npm test` — all suites pass.
- [ ] Run `npm run build` — build succeeds.
- [ ] Play a full game in the browser and check items 1–4 end to end.
