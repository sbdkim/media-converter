# Media Converter

Split-stack media conversion project with a GitHub Pages frontend and backend services for converting authorized direct media URLs into fixed presets.

## Live Demo
[https://sbdkim.github.io/media-converter/](https://sbdkim.github.io/media-converter/)

## Key Features
- Accepts authorized direct media URLs only
- Offers fixed `mp3` and `mp4` conversion presets
- Validates URLs, allowed domains, and preset requests before job creation
- Includes a browser frontend, API layer, and worker pipeline
- Supports local frontend, API, worker development, and test workflows

## Tech Stack
- Vite frontend
- Fastify API
- Node.js worker services
- `ffmpeg`-based conversion planning
- GitHub Pages for the frontend and Cloud Run-oriented backend deployment

## Setup / Run Locally
```powershell
npm.cmd install
```

Recommended development workflow:
1. `npm.cmd run dev:frontend`
2. `npm.cmd run dev:api`
3. `npm.cmd run dev:worker`

## Tests
```powershell
npm.cmd run test
```

## Deployment Notes
- GitHub Pages publishes only the static frontend.
- Live conversions require a separately deployed backend API.
- The Pages workflow reads `VITE_API_BASE_URL` from the GitHub repository variable of the same name.
- If that variable is missing, the live site stays in a safe read-only state.

## Architecture
- `frontend/` static browser UI
- `backend/api/` Fastify API service
- `backend/worker/` conversion worker pipeline
- `docs/deployment.md` deployment details and production gaps

## Privacy / Notes
- The current repo is a prototype with real UI and API contracts, but some cloud integrations are still stubbed.
- See [docs/deployment.md](./docs/deployment.md) for Cloud Run deployment details and current production limitations.
