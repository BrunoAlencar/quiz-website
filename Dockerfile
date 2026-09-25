# syntax=docker/dockerfile:1
#
# quiz-website is a custom Node server (server.ts) that wraps Next.js AND
# Socket.IO. It cannot be built with Nixpacks' Next.js auto-detection (that
# runs `next start`, which never boots the Socket.IO server). This Dockerfile
# pins the real start command: `npm start` -> `NODE_ENV=production tsx server.ts`.
#
# Single stage on purpose: `tsx` is the runtime entrypoint (a devDependency),
# and the Next build needs typescript/@types, so we keep the full dependency
# tree rather than pruning to production-only.

FROM node:22-slim
WORKDIR /app

# Install ALL dependencies first (better layer caching on source-only changes).
# Do NOT set NODE_ENV=production here — that would make `npm ci` skip the
# devDependencies (typescript, @types, tsx) that the build and runtime need.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the source and build the Next.js app into .next
COPY . .
RUN npm run build

# Runtime configuration. PORT is read by server.ts (defaults to 3000).
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# `npm start` === `NODE_ENV=production tsx server.ts`
CMD ["npm", "start"]
