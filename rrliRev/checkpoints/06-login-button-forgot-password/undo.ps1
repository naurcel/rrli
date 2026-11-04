# PowerShell Undo Script for: 06-login-button-forgot-password
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 06-login-button-forgot-password" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "Restoring backed-up files..." -ForegroundColor Yellow
Copy-Item (Join-Path $scriptDir "backup\globals.css") (Join-Path $workspaceDir "src\app\globals.css") -Force
Copy-Item (Join-Path $scriptDir "backup\page.tsx") (Join-Path $workspaceDir "src\app\login\page.tsx") -Force

Write-Host "[SUCCESS] Prompt 06 (Login button & Forgot password layout) has been reverted." -ForegroundColor Green
