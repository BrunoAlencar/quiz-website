# Kahoot-like Live Quiz — Design Spec

**Date:** 2026-09-13
**Status:** Approved

## Overview

A live, synchronized, Kahoot-style quiz web app served under the `quiz` subdomain.
A presenter drives a shared screen; players join from their phones with a code or QR
code, answer timed multiple-choice questions, and compete on a live leaderboard scored
by correctness and speed.

## Goals

- Live, synchronized play: everyone sees the same question at the same time, answers
  within a timer, and scores update after each question.
- Admin-authored quizzes: questions each have exactly 4 answer options, exactly 1 correct.
- Kahoot-style scoring: correct answers earn points, with a bonus for answering faster.
- Small scale: up to ~30 players per game session.

## Non-Goals (v1)

- Multiple concurrent host/admin accounts (single shared admin password only).
- Mid-game joins (players must join during the lobby).
- Images / media in questions.
- Question-bank import or bulk authoring.
- Analytics dashboard.
- Horizontal scaling / multi-instance real-time (single server process is sufficient).

## Architecture & Stack

One Next.js app (App Router, TypeScript) with a custom Node server for real-time.

- **Frontend:** React + TypeScript via Next.js. Three surfaces:
  - **Player** (`/join`, `/play`) — mobile-first phone experience.
  - **Presenter** (`/host`) — the big shared screen.
  - **Admin** (`/admin`) — password-gated quiz authoring.
- **Real-time:** Socket.IO on a custom Next.js server (`server.ts`). Chosen over raw
  `ws` (would require hand-rolling rooms/reconnect) and hosted services like Pusher/Ably
  (overkill/cost at this scale). Socket.IO provides rooms, auto-reconnect, and fast build.
- **Database:** PostgreSQL accessed via raw SQL through `node-postgres` (`pg`). No ORM.
  Migrations are plain `.sql` files run by a small migration script.
- **Live game state:** kept in-memory on the server (a `Map` of active games), since
  games are short-lived and single-instance. `answers` rows and final `players.score`
  are persisted to Postgres as the game progresses / ends, so results survive a restart.
- **Hosting:** a Node host (Railway/Render/Fly/VPS), NOT Vercel serverless, because live
  WebSockets need a persistent process. Served under the `quiz` subdomain.

### Rationale for key choices

- **Postgres over MongoDB:** the data is relational (quizzes → questions → options;
  games → players → answers).
- **Raw SQL via `pg` (no Prisma/ORM):** per explicit user preference. Types and
  migrations are managed manually.
- **In-memory live state (no Redis):** at ~30 players on a single instance, a `Map`
  suffices; adding Redis would be premature complexity.

## Data Model (PostgreSQL)

IDs are UUIDs unless noted.

```
quizzes
  id, title, description, created_at

questions
  id, quiz_id (FK→quizzes), text, position (order in quiz),
  time_limit_seconds (default 20), points_base (default 1000)

options
  id, question_id (FK→questions), text, is_correct (bool), position (0–3)
  -- exactly 4 rows per question, exactly 1 with is_correct=true

games
  id, quiz_id (FK→quizzes), join_code (6-char, unique, indexed),
  status ('lobby'|'in_progress'|'ended'), created_at, ended_at

players
  id, game_id (FK→games), nickname, score (final, persisted at end),
  joined_at

answers
  id, game_id (FK→games), player_id (FK→players),
  question_id (FK→questions), option_id (FK→options),
  is_correct, response_ms, points_awarded, created_at
```

**Notes:**

- During a live game, fast-changing state (current question index, timer, who has
  answered, running scores) lives in-memory. `answers` and final `players.score` are
  written to Postgres so results survive a restart and can be reviewed.
- `join_code` is the 6-character code players type; the QR code encodes the join URL
  (`https://quiz.<domain>/join?code=ABC123`).
- The "exactly 4 options, exactly 1 correct" invariant is enforced in the admin API
  validation layer (client + server), not by a DB constraint.

## Real-time Game Flow

**Socket.IO rooms:** each game gets a room keyed by `game_id`. Presenter and players in
that game join the room; broadcasts are scoped to it.

### Lobby

1. Presenter opens `/host`, picks a quiz → server creates a `games` row
   (`status='lobby'`), generates a unique `join_code`, returns it + QR.
2. Presenter screen shows the code/QR and a live-updating list of joined nicknames.
3. Player opens `/join` (typed code or QR link) → enters nickname → server creates a
   `players` row, adds the socket to the room. `player_joined` broadcast updates the
   presenter's lobby list.

### Playing a question (presenter drives the pace)

4. Presenter clicks **Start** → server sets `status='in_progress'`, loads questions into
   in-memory game state.
5. For each question, server emits `question_start` with question text, 4 options, and
   `time_limit_seconds`. Server records the authoritative start timestamp.
6. Players see 4 answer buttons; tapping emits `submit_answer {option_id}`. Server
   computes `response_ms` from its own start timestamp (never trusts client timing),
   marks correctness, computes points, writes an `answers` row, updates the in-memory
   score. Presenter shows a live count of how many have answered (not who/what).
7. Question ends when the timer expires OR everyone has answered. Server emits
   `question_result`: the correct option, each player's own result + points this round,
   and the current top leaderboard. Presenter shows the answer distribution + leaderboard.
8. Presenter clicks **Next** → repeat from step 5.

### End

9. After the last question, server sets `status='ended'`, finalizes `players.score`,
   emits `game_over` with the final leaderboard (podium on presenter, personal rank on
   players).

### Scoring formula (Kahoot-style)

Correct answers earn:

```
points = round(points_base * (1 - (response_ms / time_limit_ms) * SPEED_FACTOR))
```

with `SPEED_FACTOR = 0.5` (a tunable constant): answering instantly ≈ full points,
answering right at the buzzer ≈ half points. Wrong or no answer = 0.

### Reconnection

Socket.IO auto-reconnects. On reconnect a client sends its `player_id`/`game_id` and the
server re-syncs current state (e.g. mid-question with remaining time, or the current
leaderboard).

## Screens & UI

### Player (mobile-first)

- `/join` — code input (pre-filled from QR link) → nickname input → "waiting for host"
  lobby.
- `/play` — during a question: 4 large colored answer buttons (Kahoot-style
  red/blue/yellow/green + shapes) with a countdown; after answering: "answer locked,
  waiting"; between questions: personal result ("+740 pts, rank 3"); at end: final rank.

### Presenter (big screen)

- `/host` — quiz picker → lobby (large join code + QR + live nickname list + Start).
- During play: question text + 4 options + countdown + live "answered N/M" count.
- After each question: answer distribution bar chart + leaderboard top list + Next button.
- At end: podium.

### Admin (`/admin`, password-gated)

- Login (shared password → httpOnly session cookie).
- Quiz list → create/edit quiz: title/description + questions, each with text, time
  limit, and 4 options (radio marks the correct one). Client + server validation enforces
  exactly 4 options / exactly 1 correct.

## Error & Edge Handling

- Invalid/expired join code → clear error on `/join`.
- Duplicate nickname in same game → server appends a suffix (e.g. "Alex (2)").
- Joining after game started → rejected with a message (no mid-game joins in v1).
- Double-submit / submit after timer → server ignores; first answer per question per
  player wins.
- Presenter disconnect → game state survives in memory; presenter reconnects and resumes.
- Server process restart mid-game → in-memory game is lost (acceptable for v1; persisted
  answers remain for review).
- Admin password checked server-side only; never shipped to the client.

## Non-Functionals

- **Testing:** unit tests for scoring, join-code generation, and admin validation;
  integration tests for the Socket.IO event flow (lobby → question → result → game over)
  with mock clients.
- **Config (env):** `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `PORT`.
- **Security:** admin auth via shared password → httpOnly session cookie; server is the
  sole authority for timing, scoring, and correctness.
