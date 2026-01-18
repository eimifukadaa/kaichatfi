
# Setup Vercel Deployment Secrets for GitHub
# Run this script to get your IDs for GitHub Secrets

Write-Host "--- VERCEL AUTOMATION SETUP ---" -ForegroundColor Cyan

if (!(Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "Error: npm/npx not found. Please install Node.js." -ForegroundColor Red
    exit
}

Write-Host "1. Logging into Vercel..."
npx vercel login

Write-Host "2. Linking project to get IDs..."
npx vercel link --yes

$vercelDir = Join-Path $PSScriptRoot ".vercel"
$projectJsonPath = Join-Path $vercelDir "project.json"

if (Test-Path $projectJsonPath) {
    $projectJson = Get-Content $projectJsonPath | ConvertFrom-Json
    Write-Host "`n!!! COPY THESE TO GITHUB SECRETS !!!" -ForegroundColor Green
    Write-Host "VERCEL_ORG_ID: $($projectJson.orgId)" -ForegroundColor Yellow
    Write-Host "VERCEL_PROJECT_ID: $($projectJson.projectId)" -ForegroundColor Yellow
    Write-Host "`nYou also need a VERCEL_TOKEN from https://vercel.com/account/tokens" -ForegroundColor Cyan
} else {
    Write-Host "Error: .vercel/project.json not found. Link failed." -ForegroundColor Red
}

Write-Host "`n3. Pushing automation to GitHub..."
git add .
git commit -m "feat: add automatic vercel deployment workflow"
git push origin main

Write-Host "`nDONE! Once you add the secrets to GitHub, every push will live deploy!" -ForegroundColor Green
