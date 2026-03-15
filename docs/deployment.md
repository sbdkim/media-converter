# Deployment Notes

## Current live shape
- GitHub Pages serves the frontend from `frontend/dist`
- Cloud Run should serve `backend/api`
- The frontend now depends on `POST /api/resolve` for public page URLs before a job can be created
- The API container must include both `yt-dlp` and `ffmpeg`
- The current live path still uses:
  - in-memory job state
  - inline processing inside the API service
  - placeholder upload/signing behavior

This is enough for a practical first deployment, but it is still not a durable production architecture.

## What must be true for resolve to work
- The deployed API must include the new route in `backend/api/src/app.js`.
- The API image built from `backend/api/Dockerfile` must install:
  - `yt-dlp` for metadata extraction and page-media download
  - `ffmpeg` for conversion in the inline job runner
- GitHub Pages must be rebuilt with `VITE_API_BASE_URL` set to the deployed API origin
- `FRONTEND_ORIGIN` on the API must match the GitHub Pages origin exactly

If any of those are missing, clicking `Resolve source` can validate locally in the browser but will not produce a preview.

## Phase 1 deployment
Phase 1 keeps the current inline API processing model and makes it deployable.

What Phase 1 includes:
- public Cloud Run API
- `POST /api/resolve`
- `POST /api/jobs`
- `GET /api/jobs/:jobId`
- `yt-dlp` and `ffmpeg` inside the API container
- `USE_IN_MEMORY_STORE=true`
- GitHub Pages frontend configured with `VITE_API_BASE_URL`

What Phase 1 does not include:
- Firestore
- Cloud Tasks
- Cloud Storage
- durable worker-backed job execution

## Required local prerequisites
- Google Cloud CLI (`gcloud`)
- authenticated `gcloud` session
- billing-enabled GCP project with Cloud Run and Cloud Build enabled

## Deploy the API
1. Authenticate and select the project:
   ```powershell
   gcloud auth login
   gcloud config set project <your-project-id>
   ```
2. Enable required services:
   ```powershell
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```
3. Deploy the API from the repo root:
   ```powershell
   .\scripts\deploy-api-cloud-run.ps1 -ProjectId <your-project-id> -FrontendOrigin "https://sbdkim.github.io/convert-media/"
   ```
4. Copy the resulting Cloud Run service URL.

`AllowedSourceDomains` is optional in this phase. Leave it blank unless you want to allow extra direct-file hosts beyond the built-in public extractor platforms and explicit direct-media URLs.

## Verify the API before rebuilding the frontend
1. Health check:
   ```powershell
   curl https://<your-cloud-run-url>/health
   ```
2. Resolve a public YouTube URL:
   ```powershell
   curl -X POST https://<your-cloud-run-url>/api/resolve `
     -H "content-type: application/json" `
     -d '{"sourceUrl":"https://www.youtube.com/watch?v=TWPSmBzziYM"}'
   ```
3. Confirm the response includes:
   - `platform`
   - `title`
   - `availableOutputs`
   - `resolveToken`
4. If resolve fails with `EXTRACTOR_UNAVAILABLE`, the container was deployed without `yt-dlp`.
5. If job creation later fails during processing, verify the container also has `ffmpeg`.

## Rebuild the frontend
1. In GitHub, set repository variable `VITE_API_BASE_URL=https://<your-cloud-run-url>`
2. Re-run the Pages deploy workflow
3. Load the GitHub Pages site and confirm the backend badge shows a configured API target instead of read-only mode

## Manual acceptance flow
1. Paste a public YouTube or Instagram URL
2. Click `Resolve source`
3. Confirm metadata preview and output options appear
4. Choose output and preset
5. Create the job
6. Wait for status to move from `queued` to `processing` to `completed`
7. Download the output

## Current limitations
- Job state is in memory and will be lost on service restart
- Output download links are placeholder signed URLs
- Inline processing inside the API service is convenient for phase 1 but not ideal for scale or reliability
- Public content only:
  - no cookies
  - no private posts
  - no login-required content
  - no age-gated or livestream handling in phase 1

## Next production-hardening steps
- Move job state from the in-memory store to Firestore
- Replace inline processing with Cloud Tasks plus the worker service
- Replace placeholder output storage/signing with Cloud Storage
- Add service-to-service authentication between API and worker
- Add runtime observability and binary/version checks during deployment
