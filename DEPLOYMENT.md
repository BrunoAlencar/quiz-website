# Deployment Guide (Coolify on AWS EC2)

This app is hosted at **`https://quiz.brunoalencar.dev`** on the same Coolify
instance that serves the portfolio (`brunoalencar.dev`). It shares that box's
infrastructure — see the portfolio repo's `DEPLOYMENT.md` for the full
inventory (EC2 `i-00c26408fa0c53cc5`, Elastic IP `52.18.148.185`, Route 53
zone `Z088520914C8XJPW6NY0`, region `eu-west-1`, SSM-only access).

## Why this app is different from the portfolio

The portfolio is a plain Next.js app deployed via Nixpacks. **This one is not.**
`server.ts` boots a custom Node HTTP server that wraps Next.js *and* a
Socket.IO server for the live quiz. Nixpacks' Next.js auto-detection would run
`next start` and never start Socket.IO, so this app is built from the
committed **`Dockerfile`** instead. It also needs a **PostgreSQL** database and
several environment variables.

**`.dev` TLS gotcha (inherited):** `*.dev` is HSTS-preloaded in every major
browser, so plain HTTP is refused unconditionally — the subdomain must resolve
to the box and get a real Let's Encrypt cert (Coolify issues it once DNS points
at the Elastic IP). There is no HTTP fallback.

## Prerequisites (one-time)

1. **DNS** — an `A` record `quiz.brunoalencar.dev` → `52.18.148.185` in Route 53
   zone `Z088520914C8XJPW6NY0`.
2. **GitHub App access** — grant the Coolify GitHub App access to
   `BrunoAlencar/quiz-website` (private, same org as the portfolio).
3. Deploy branch is **`main`**.

## Coolify setup

1. **PostgreSQL resource** — create a PostgreSQL database in the same Coolify
   project. Copy its **internal** connection URL (reachable by other resources
   on Coolify's Docker network, e.g. `postgres://postgres:<pw>@<internal-host>:5432/postgres`).

2. **Application resource** — create an Application:
   - Source: the `BrunoAlencar/quiz-website` GitHub repo, branch `main`
   - **Build Pack: Dockerfile** (not Nixpacks)
   - Port: `3000`
   - Domain: `https://quiz.brunoalencar.dev`

3. **Environment variables** (Application → Environment Variables):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the internal Postgres URL from step 1 |
   | `ADMIN_PASSWORD` | a shared password for `/admin` |
   | `SESSION_SECRET` | a fresh long random string |
   | `PORT` | `3000` |

   `DATABASE_URL_TEST` is **not** needed in production (tests only).

4. **Migrations** — set `npm run migrate` as a **post-deployment command**
   (Application → General → Post-deployment Command). The migration runner is
   idempotent (it tracks applied files in a `_migrations` table), so it is safe
   to run on every deploy and will auto-apply any future migrations.

5. **Traefik label fix (known Coolify v4.1.2 bug — same as the portfolio).**
   Coolify's label generator emits a broken rule for the domain:
   `Host(``) && PathPrefix(`quiz.brunoalencar.dev`)` (empty `Host()`, domain
   shoved into `PathPrefix`). Left as-is, the site 404s and only gets Traefik's
   placeholder cert. See coollabsio/coolify#7092 and #8775.

   **Fix:** in Application → **Container Labels**, uncheck **"Readonly labels"**,
   then for **both** the http and https routers replace the broken rule with the
   correct one and drop the bogus `PathPrefix`:

   ```
   traefik.http.routers.<router>.rule=Host(`quiz.brunoalencar.dev`)
   ```

   Leave everything else Coolify generated intact (service port `3000`, the
   `tls.certresolver=letsencrypt` on the https router, the http→https redirect
   middleware, gzip, etc.). Because these are Docker labels, Traefik's Docker
   provider re-discovers them on every redeploy — this survives future deploys
   **unless** "Readonly labels" gets re-checked or "Reset Labels to Defaults" is
   clicked, which regenerates the buggy rule. If the site ever 404s or serves
   `CN=TRAEFIK DEFAULT CERT` after a redeploy, check Container Labels first.

   WebSocket upgrades (Socket.IO) ride the same https router automatically — no
   extra Traefik config is required. This app runs a single instance, so no
   sticky-session / Redis adapter is needed.

## Optional: seed a quiz

To load a quiz into the production DB, run once via the Application's container
terminal (Coolify → Application → Terminal). `DATABASE_URL` is already in the
container's environment, so the npm scripts work as-is:

```bash
npm run seed:styleguide   # "Styleguide QueroDelivery" — 15 questions
```

Re-running the script inserts a **new** copy of the quiz, so run it only once
per environment.

## Redeploying after changes

Coolify redeploys automatically on every push to `main` via the GitHub App
webhook. The post-deployment command re-runs migrations idempotently.

```bash
git checkout main
git merge <feature-branch>
git push
```

## Post-deploy checklist

- [ ] `https://quiz.brunoalencar.dev` returns 200 with a real Let's Encrypt cert
- [ ] Plain HTTP redirects to HTTPS
- [ ] `/admin` accepts `ADMIN_PASSWORD`
- [ ] Create a quiz, open `/host`, scan the QR from a phone, join, and confirm
      answers/scores update live (verifies the Socket.IO path through Traefik)
