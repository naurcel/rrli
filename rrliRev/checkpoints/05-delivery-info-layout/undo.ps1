# PowerShell Undo Script for: 05-delivery-info-layout
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 05-delivery-info-layout (Delivery Info Improvements)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "Restoring backed-up files..." -ForegroundColor Yellow
Copy-Item (Join-Path $scriptDir "backup\deliveries-page.tsx") (Join-Path $workspaceDir "src\app\(workspace)\deliveries\page.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\globals.css") (Join-Path $workspaceDir "src\app\globals.css") -Force
Copy-Item (Join-Path $scriptDir "backup\package.json") (Join-Path $workspaceDir "package.json") -Force

Write-Host "Removing newly added files..." -ForegroundColor Yellow
$testFile = Join-Path $workspaceDir "src\features\deliveries\delivery-layout.test.ts"
if (Test-Path $testFile) { Remove-Item $testFile -Force }
$compFile = Join-Path $workspaceDir "src\components\delivery-crew-section.tsx"
if (Test-Path $compFile) { Remove-Item $compFile -Force }
$utilsFile = Join-Path $workspaceDir "src\features\deliveries\crew-utils.ts"
if (Test-Path $utilsFile) { Remove-Item $utilsFile -Force }

Write-Host "[SUCCESS] Prompt 05 (Delivery Info Improvements) has been reverted." -ForegroundColor Green