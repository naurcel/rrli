# PowerShell Undo Script for: 10-settings-layout-and-profile-photo
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 10-settings-layout-and-profile-photo" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "Restoring backed-up files..." -ForegroundColor Yellow
Copy-Item (Join-Path $scriptDir "backup\settings-page.tsx") (Join-Path $workspaceDir "src\app\(workspace)\settings\page.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\account-control.tsx") (Join-Path $workspaceDir "src\components\account-control.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\operational-topbar.tsx") (Join-Path $workspaceDir "src\components\operational-topbar.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\server-account-store.ts") (Join-Path $workspaceDir "src\lib\auth\server-account-store.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\server-session.ts") (Join-Path $workspaceDir "src\lib\auth\server-session.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\account-route.ts") (Join-Path $workspaceDir "src\app\api\auth\account\route.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\globals.css") (Join-Path $workspaceDir "src\app\globals.css") -Force
Copy-Item (Join-Path $scriptDir "backup\package.json") (Join-Path $workspaceDir "package.json") -Force

Write-Host "Removing added test and helper files..." -ForegroundColor Yellow
$testFile = Join-Path $workspaceDir "src\features\users\settings-profile-photo.test.ts"
if (Test-Path $testFile) { Remove-Item $testFile -Force }
$helperFile = Join-Path $workspaceDir "src\components\profile-photo.ts"
if (Test-Path $helperFile) { Remove-Item $helperFile -Force }
$helperFileX = Join-Path $workspaceDir "src\components\profile-photo.tsx"
if (Test-Path $helperFileX) { Remove-Item $helperFileX -Force }

Write-Host "[SUCCESS] Prompt 10 (Settings Page Layout and Profile Photo) has been reverted." -ForegroundColor Green
