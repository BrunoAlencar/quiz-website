# Dashboard, Tick Sound, Full Ranking and Longer Timer — Design

Date: 2026-10-04

## Goal

Four changes to the live quiz app:

1. The host's final results screen lists every participant with their score.
2. A new admin dashboard shows data from past games.
3. The host screen plays a tick each second while a question's countdown runs.
4. Every quiz gets 10 more seconds per question (20s becomes 30s).

## 1. Full participant list

- `src/app/host/page.tsx`, phase `over`: render `<Leaderboard entries={board} />`
  instead of `board.slice(0, 5)`.
- The per-question leaderboard (phase `result`) stays at the top 5.
- The server already emits the full ranking in `game:over`; no server change.
- CSS: the final board gets a max height and `overflow-y: auto` so a long list
  scrolls inside the screen instead of pushing the page.
- Player phones are unchanged (own score and rank only).

## 2. Admin dashboard

### Access and routing

- Page: `/admin/dashboard` (`src/app/admin/dashboard/page.tsx`), client
  component like the other admin pages.
- Protected by the existing `admin_session` cookie. If the API returns 401 the
  page shows a link back to `/admin` to log in.
- `/admin` gets a "Dashboard" link next to "New quiz".

### Scope of data

Only games with `status = 'ended'` are counted. Abandoned lobbies and games
still in progress are ignored everywhere.

### Sections

**Overview** — four stat tiles:

| Tile | Definition |
|---|---|
| Games played | count of ended games |
| Participants | count of players in ended games |
| Average accuracy | correct answers / answers given, across ended games, as a whole percent; "–" when there are no answers |
| Most played quiz | quiz title with the most ended games (ties: most recent game wins); "–" when none |

**Game history** — table, newest first (by `ended_at`), limited to the 100 most
recent games: quiz title, date, player count, winner nickname and score.
Clicking a row expands the game's full final ranking (rank, nickname, score)
using the existing `Leaderboard` component. Ranking order: score descending,
then `joined_at` ascending as a stable tie-break.

**Question difficulty** — a quiz selector (quizzes that have at least one ended
game). For the selected quiz, one row per question, hardest first (lowest %
correct, questions with no answers last): question text, % correct with a CSS
bar, answers given, average response time in seconds (one decimal).

Accuracy is correct answers out of answers given. Players who let the timer
run out leave no `answers` row and are not counted.

### Known limitation (accepted)

`updateQuiz` deletes and recreates a quiz's questions, and `answers` cascade
off `questions`. So saving a quiz in the admin editor, or re-running a seed,
erases the per-answer history for that quiz. Game history and final scores
survive (they hang off `games`/`players`). The difficulty section therefore
only reflects games played since the quiz was last saved, and shows a one-line
note saying so. Rewriting `updateQuiz` to edit in place is out of scope.

### Server

`src/server/repositories/stats.ts` — read-only queries, each taking `db`:

- `getOverview(db)` → `{ games_played, participants, accuracy_pct: number | null, top_quiz_title: string | null }`
- `listPastGames(db, limit = 100)` → `PastGame[]`:
  `{ id, quiz_id, quiz_title, ended_at, player_count, winner_nickname: string | null, winner_score: number | null }`
- `getGameRanking(db, gameId)` → `LeaderboardEntry[]` (empty array for an
  unknown game)
- `getQuestionStats(db, quizId)` → `QuestionStat[]`:
  `{ question_id, text, position, answers, correct, correct_pct: number | null, avg_response_ms: number | null }`

Types `DashboardOverview`, `PastGame`, `QuestionStat` live in `src/types/index.ts`.

API routes (same `authed()` check as the quiz routes, 401 when not logged in):

- `GET /api/admin/dashboard` → `{ overview, games }`
- `GET /api/admin/games/[id]` → `{ ranking }`
- `GET /api/admin/quizzes/[id]/stats` → `{ questions }`

The quiz selector is derived client-side from the distinct quizzes in `games`.

### Error handling

A failed fetch shows a short inline error in that section; the other sections
still render. Empty states: "No finished games yet." for history, and the
difficulty section is hidden when there are no games.

## 3. Tick sound

- `src/lib/tickSound.ts`: `playTick(urgent: boolean)` using the Web Audio API —
  a single lazily created `AudioContext`, a short (about 50 ms) oscillator
  blip with a fast gain decay. Normal tick about 800 Hz, urgent tick about
  1200 Hz. No audio asset. Failures (no Web Audio, suspended context) are
  swallowed; the game must never break because of sound.
- `Countdown` gains an optional `sound?: boolean` prop. When true it plays a
  tick each time the remaining value decreases while it is above 0; urgent when
  5 or fewer seconds remain. No tick at 0.
- Host page passes `sound={!muted}`. A mute toggle button sits beside the
  timer; the choice is stored in `localStorage` under `quiz:muted` (read in an
  effect, wrapped in try/catch).
- The play page does not pass `sound`, so phones are silent.
- Browser autoplay rules are satisfied because the host clicks to pick a quiz
  and to start the game before any tick plays.

## 4. Ten more seconds

- `db/migrations/002_time_limit_plus_10.sql`:
  `UPDATE questions SET time_limit_seconds = time_limit_seconds + 10;` and
  `ALTER TABLE questions ALTER COLUMN time_limit_seconds SET DEFAULT 30;`
- Seeds (`seed-general-knowledge.ts`, `seed-kafka-partitions.ts`,
  `seed-styleguide.ts`) and the admin "new question" defaults
  (`admin/page.tsx`, `admin/quiz/[id]/page.tsx`) change 20 to 30.
- Done by migration, not by re-seeding, so existing answer history is kept.
- Scoring is unchanged: the speed bonus already scales with the time limit.

## Testing

- `tests/server/stats.test.ts` (test database, written first): overview totals
  and accuracy, ended-only filtering, game list order and winner, ranking
  order, question stats incl. a question with no answers, empty database.
- Migration: a repository-level test is not practical (the test DB is built by
  the migration runner), so it is verified by running `npm run migrate` and
  querying the result.
- Sound, mute toggle and the full final list are verified by running a game in
  the browser.
- Existing suite keeps passing; `npm run build` passes.
