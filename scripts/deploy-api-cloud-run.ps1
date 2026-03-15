param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Region = "asia-northeast3",

  [Parameter(Mandatory = $false)]
  [string]$ServiceName = "convert-media-api",

  [Parameter(Mandatory = $false)]
  [string]$AllowedSourceDomains = "",

  [Parameter(Mandatory = $false)]
  [string]$FrontendOrigin = "https://sbdkim.github.io/convert-media/",

  [Parameter(Mandatory = $false)]
  [string]$MaxSourceSizeMb = "250",

  [Parameter(Mandatory = $false)]
  [string]$SignedUrlTtlMinutes = "30"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "gcloud CLI is not installed or not on PATH."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceDir = Join-Path $repoRoot "backend\api"

Write-Host "Deploying Cloud Run service '$ServiceName' from $sourceDir"

$envVars = @(
  "PORT=8080"
  "NODE_ENV=production"
  "FRONTEND_ORIGIN=$FrontendOrigin"
  "ALLOWED_SOURCE_DOMAINS=$AllowedSourceDomains"
  "MAX_SOURCE_SIZE_MB=$MaxSourceSizeMb"
  "SIGNED_URL_TTL_MINUTES=$SignedUrlTtlMinutes"
  "USE_IN_MEMORY_STORE=true"
)

gcloud run deploy $ServiceName `
  --project $ProjectId `
  --region $Region `
  --source $sourceDir `
  --allow-unauthenticated `
  --set-env-vars ($envVars -join ",")

Write-Host "Deployment command completed. Next:"
Write-Host "1. Copy the service URL from gcloud output."
Write-Host "2. Verify the API responds on /health and /api/resolve."
Write-Host "3. Set the GitHub repository variable VITE_API_BASE_URL to that URL."
Write-Host "4. Re-run the Deploy Pages workflow."
