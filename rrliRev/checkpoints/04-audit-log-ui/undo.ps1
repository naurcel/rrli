# PowerShell Undo Script for: 04-audit-log-ui
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 04-audit-log-ui (Audit Log UI Improvements)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "Restoring backed-up files..." -ForegroundColor Yellow
Copy-Item (Join-Path $scriptDir "backup\user-management-page.tsx") (Join-Path $workspaceDir "src\app\(workspace)\user-management\page.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\globals.css") (Join-Path $workspaceDir "src\app\globals.css") -Force
Copy-Item (Join-Path $scriptDir "backup\package.json") (Join-Path $workspaceDir "package.json") -Force

Write-Host "Removing newly added files..." -ForegroundColor Yellow
$testFile = Join-Path $workspaceDir "src\features\audit\audit-ui.test.ts"
if (Test-Path $testFile) { Remove-Item $testFile -Force }
$compFile = Join-Path $workspaceDir "src\components\audit-state-changes.tsx"
if (Test-Path $compFile) { Remove-Item $compFile -Force }
$utilsFile = Join-Path $workspaceDir "src\features\audit\audit-formatters.ts"
if (Test-Path $utilsFile) { Remove-Item $utilsFile -Force }

Write-Host "[SUCCESS] Prompt 04 (Audit Log UI Improvements) has been reverted." -ForegroundColor Green
