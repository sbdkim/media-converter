param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$Region = "asia-northeast3",

  [Parameter(Mandatory = $false)]
  [string]$ServiceName = "media-converter-api",

  [Parameter(Mandatory = $true)]
  [string]$AllowedSourceDomains,

  [Parameter(Mandatory = $false)]
  [string]$FrontendOrigin = "https://sbdkim.github.io/media-converter/",

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

gcloud run deploy $ServiceName `
  --project $ProjectId `
  --region $Region `
  --source $sourceDir `
  --allow-unauthenticated `
  --set-env-vars "PORT=8080,NODE_ENV=production,FRONTEND_ORIGIN=$FrontendOrigin,ALLOWED_SOURCE_DOMAINS=$AllowedSourceDomains,MAX_SOURCE_SIZE_MB=$MaxSourceSizeMb,SIGNED_URL_TTL_MINUTES=$SignedUrlTtlMinutes,USE_IN_MEMORY_STORE=true"

Write-Host "Deployment command completed. Next:"
Write-Host "1. Copy the service URL from gcloud output."
Write-Host "2. Set the GitHub repository variable VITE_API_BASE_URL to that URL."
Write-Host "3. Re-run the Deploy Pages workflow."
