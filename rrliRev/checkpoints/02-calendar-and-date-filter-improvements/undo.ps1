# PowerShell Undo Script for: 02-calendar-and-date-filter-improvements
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 02-calendar-and-date-filter-improvements" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "Restoring backed-up files..." -ForegroundColor Yellow
Copy-Item (Join-Path $scriptDir "backup\global-date-range-picker.tsx") (Join-Path $workspaceDir "src\components\global-date-range-picker.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\globals.css") (Join-Path $workspaceDir "src\app\globals.css") -Force
Copy-Item (Join-Path $scriptDir "backup\package.json") (Join-Path $workspaceDir "package.json") -Force

Write-Host "Removing newly added files..." -ForegroundColor Yellow
$testFile = Join-Path $workspaceDir "src\components\global-date-range-picker.test.ts"
if (Test-Path $testFile) { Remove-Item $testFile -Force }

Write-Host "[SUCCESS] Prompt 02 (Calendar and Date Filter Improvements) has been reverted." -ForegroundColor Green

