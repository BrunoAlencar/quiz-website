# Quiz Website – Live Kahoot-Style Quiz App

A real-time, multiplayer quiz application built with Next.js, Node.js, Socket.IO, and PostgreSQL. Host presents questions, players join via code or QR, and the system calculates scores with speed bonuses.

## Prerequisites

- **Node.js**: v20+ (tested on v22)
- **PostgreSQL**: 12+ running locally or remotely

## Environment Variables

Create a `.env.local` file in the project root with the following variables (see `.env.example`):

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/quiz
DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/quiz_test
ADMIN_PASSWORD=change-me
SESSION_SECRET=change-me-too-long-random
PORT=3000
```

**Notes:**
- `DATABASE_URL`: Connection string to the main database. Default assumes PostgreSQL on localhost:5432 with user `postgres` and password `postgres`.
- `DATABASE_URL_TEST`: Connection string to a separate test database (used by vitest).
- `ADMIN_PASSWORD`: Shared password for the admin authoring interface (`/admin`).
- `SESSION_SECRET`: Long random string for session encryption.
- `PORT`: Server port (default 3000).

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Databases

Create two PostgreSQL databases:

```sql
createdb quiz
createdb quiz_test
```

Or via psql:

```bash
psql -U postgres -c "CREATE DATABASE quiz;"
psql -U postgres -c "CREATE DATABASE quiz_test;"
```

### 3. Run Migrations

Run migrations against both databases. The migration script reads the `DATABASE_URL` environment variable, so run it once per database, setting the variable inline:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/quiz npm run migrate
DATABASE_URL=postgres://postgres:postgres@localhost:5432/quiz_test npm run migrate
```

(If `DATABASE_URL` is already exported in your shell or `.env`, `npm run migrate` migrates that database.)

### 4. Start Development Server

```bash
npm run dev
```

The server starts on `http://localhost:3000` (or the port specified in `.env.local`). The app is served under a `quiz` subdomain in production, but runs at the root locally.

## Testing

Tests use vitest and require `DATABASE_URL_TEST` to connect to the test database.

```bash
npm test
```

Or run with the environment variable set inline:

```bash
DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/quiz_test npx vitest run
```

For watch mode:

```bash
npm run test:watch
```

## Application Surfaces

The app has three main interfaces:

### `/admin` – Quiz Authoring
Password-gated interface for creating and editing quizzes. Requires the `ADMIN_PASSWORD` from `.env.local`.

### `/host` – Presenter View
Large-screen display for the quiz host. Shows the current question, response status, and results in real-time using Socket.IO.

### `/join` – Player Interface
Players join via:
- `/join` – Enter a quiz code manually
- `/join?code=CODE` – Direct join with code in URL
- QR code link – Scans to the `/join?code=CODE` URL

Players select a nickname and answer questions live. Responses are submitted via WebSocket and scored immediately.

## Scoring

Scores are calculated based on:
- **Correctness**: Points awarded only for correct answers.
- **Speed bonus**: Faster responses earn higher scores using the formula:

```
score = base_points × (1 - (response_time / time_limit) × SPEED_FACTOR)
```

The `SPEED_FACTOR` constant is defined in `src/lib/scoring.ts` (default: `0.5`). Adjust this to control how much speed vs. accuracy is rewarded.

## Deployment

### Build for Production

```bash
npm run build
npm start
```

### Hosting Requirements

**Do NOT deploy to Vercel serverless.** This app requires a persistent Node.js process because it uses Socket.IO for real-time WebSocket communication.

Suitable hosts:
- **Railway** (nodejs.railway.app)
- **Render** (https://render.com)
- **Fly.io** (https://fly.io)
- **VPS** (AWS EC2, DigitalOcean, Linode, etc.)

### Deployment Steps

1. **Set all environment variables** on your hosting platform:
   - `DATABASE_URL` (production database)
   - `DATABASE_URL_TEST` (or omit if tests don't run in production)
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
   - `PORT` (if not 3000)

2. **Run migrations** on the production database:
   ```bash
   npm run migrate
   ```
   (Usually done as a one-time setup or as part of a deployment script.)

3. **Build and start**:
   ```bash
   npm run build
   npm start
   ```

4. **Serve under the `quiz` subdomain**:
   - If using a reverse proxy (Nginx, Caddy), configure it to forward requests from `quiz.yourdomain.com` to `localhost:PORT`.
   - If your hosting platform provides automatic routing, ensure the app is mapped to the `quiz` subdomain.

### Socket.IO Note

Socket.IO connections are persistent and stateful. Ensure:
- Your host does not terminate connections abruptly.
- If using load balancing with multiple instances, configure sticky sessions or Socket.IO adapters (e.g., Redis).
- CORS is properly configured (the app includes Socket.IO CORS headers by default).

## Project Structure

- `src/app/` – Next.js App Router pages (admin, host, join, play)
- `src/lib/` – Utility functions (scoring, join code generation, etc.)
- `src/types/` – TypeScript type definitions for socket events and data models
- `db/` – Database migrations and schema
- `server.ts` – Custom Node.js server hosting Socket.IO
- `package.json` – Scripts and dependencies

## License

Private project.
