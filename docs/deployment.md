# Deployment Notes

## Current prototype
- GitHub Pages can host the frontend from `frontend/dist`
- The frontend, API contract, and worker process pipeline are implemented
- Cloud Tasks is **not wired**; the API currently uses a placeholder queue interface
- Firestore is **not wired**; the API currently uses an in-memory job store
- Cloud Storage upload and signed download generation are **not wired**; the worker currently uses placeholder storage/signing adapters
- The prototype is suitable for UI testing, API testing, worker testing, and repo hardening, not for production conversion traffic

## Intended production architecture
- GitHub Pages serves the static frontend from `frontend/dist`
- Cloud Run API receives job requests and writes job metadata
- Cloud Tasks dispatches work to the worker
- Cloud Run worker downloads source media, runs `ffmpeg`, uploads output, and updates status
- Cloud Storage stores temporary source files and converted outputs
- Firestore stores job state

## Recommended services
- `authorized-media-api`
- `authorized-media-worker`
- Firestore in native mode
- One temp bucket and one output bucket
- A Cloud Tasks queue for conversion jobs

## Required production integrations
- Replace the placeholder queue in `backend/api/src/lib/jobQueue.js` with Cloud Tasks
- Replace the in-memory store in `backend/api/src/store/inMemoryJobStore.js` with Firestore
- Replace the placeholder storage/signing adapters in `backend/worker/src/server.js` with Cloud Storage upload and signed URL generation
- Add service-to-service authentication between the API and worker

## API environment variables
- `PORT=8080`
- `NODE_ENV=production`
- `FRONTEND_ORIGIN=https://<user>.github.io/<repo>/`
- `ALLOWED_SOURCE_DOMAINS=media.example.com,cdn.example.com`
- `MAX_SOURCE_SIZE_MB=250`
- `SIGNED_URL_TTL_MINUTES=30`

Optional local-development variable:
- `USE_IN_MEMORY_STORE=true`

## Worker environment variables
- `PORT=8080`
- `OUTPUT_BUCKET=<bucket>`
- `TEMP_BUCKET=<bucket>`
- `SIGNED_URL_TTL_MINUTES=30`

Additional production wiring will likely need:
- service account credentials or workload identity
- Cloud Tasks queue name and target URL
- Firestore project configuration
- Cloud Storage bucket configuration

## Firestore job document shape
```json
{
  "jobId": "job_123",
  "sourceUrl": "https://media.example.com/sample.mp4",
  "sourceDomain": "media.example.com",
  "outputFormat": "mp3",
  "qualityPreset": "mp3-128k",
  "status": "processing",
  "progress": 65,
  "storagePath": "outputs/job_123/result.mp3",
  "downloadExpiresAt": "2026-03-09T12:30:00.000Z",
  "errorCode": null,
  "createdAt": "2026-03-09T12:00:00.000Z",
  "updatedAt": "2026-03-09T12:05:00.000Z"
}
```

## GitHub Pages
- Build the frontend with `npm --workspace frontend run build`
- Publish `frontend/dist`
- Keep Vite `base: './'` so repo-subpath deployments work

## CI and deploy expectation
- CI should run frontend tests, API tests, worker tests, and frontend build
- GitHub Pages deployment should publish only the frontend output

## Cloud Run build strategy
- Build each service separately with the Dockerfiles in `backend/api/` and `backend/worker/`
- Point Cloud Tasks to the worker endpoint with an authenticated service account
