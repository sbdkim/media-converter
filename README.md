# Media Converter

A split-stack prototype for converting **authorized direct media URLs** into fixed `mp3` and `mp4` presets.

## Supported v1 scope
- Authorized direct media URLs only
- Fixed output presets only:
  - `mp3-128k`
  - `mp3-320k`
  - `mp4-360p`
  - `mp4-720p`
- No third-party platform extraction
- No search, accounts, or browser-side transcoding

## What is implemented now
- `frontend/`: Vite app built for GitHub Pages with form validation, preset selection, job submission, and polling UI
- `backend/api/`: Fastify API with request validation, domain allowlist checks, preset validation, and job status endpoints
- `backend/worker/`: Worker service with preset-based `ffmpeg` planning and a process pipeline behind injectable dependencies
- test coverage for frontend validation/state logic, API contracts, and worker behavior

## What is still stubbed
- Cloud Tasks enqueueing is represented by a placeholder queue implementation
- Firestore persistence is represented by an in-memory job store
- Cloud Storage upload and signed download generation are represented by worker interfaces/placeholders
- Full end-to-end local conversion is not wired automatically through the API queue yet

Prototype API shape and worker pipeline are in place; cloud integrations are stubbed.

## Architecture
1. Browser submits a job to the API.
2. API validates the URL, preset, and allowed domain.
3. API queues work for the worker.
4. Worker downloads and converts media with `ffmpeg`.
5. Storage/signing returns a download URL.

Current prototype status:
The browser, API contract, and worker pipeline exist today. The queue, persistence, and cloud storage/signing parts still need production wiring.

## Repo layout
- `frontend/`: static GitHub Pages frontend
- `backend/api/`: Fastify API service
- `backend/worker/`: worker service for conversion
- `docs/deployment.md`: prototype-vs-production deployment notes

## Local setup
```powershell
npm.cmd install
npm.cmd run test
npm.cmd run build
```

## Local development
Available top-level scripts:
- `npm.cmd run dev:frontend`
- `npm.cmd run dev:api`
- `npm.cmd run dev:worker`
- `npm.cmd run dev`

Recommended local workflow:
1. Run `npm.cmd run dev:frontend`
2. Run `npm.cmd run dev:api`
3. Run `npm.cmd run dev:worker`

Default local ports:
- frontend dev server: Vite default port chosen by Vite, usually `5173`
- API: `8080`
- worker: `8080` unless started separately with a different `PORT`

## GitHub Pages reality
- GitHub Pages publishes only the static frontend.
- Live job submission requires a separately deployed backend API.
- The Pages workflow reads `VITE_API_BASE_URL` from the GitHub repository variable of the same name.
- If that variable is not set, the live site will load in a safe read-only state and explain that backend configuration is missing.

## Local testing reality
- Frontend can be tested now
- API contract can be tested now
- Worker behavior can be tested now
- Full end-to-end local conversion is not yet automatically triggered by the API queue

## Environment
Copy the example files before running locally:
- `frontend/.env.example`
- `backend/api/.env.example`
- `backend/worker/.env.example`

See [docs/deployment.md](./docs/deployment.md) for the current prototype status and the production integrations still required.
