# PowerShell Undo Script for: 09-truck-management-and-filtering
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 09-truck-management-and-filtering" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "Restoring backed-up files..." -ForegroundColor Yellow
Copy-Item (Join-Path $scriptDir "backup\truck-profitability-page.tsx") (Join-Path $workspaceDir "src\app\(workspace)\truck-profitability\page.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\truck-profitability-detail-page.tsx") (Join-Path $workspaceDir "src\app\(workspace)\truck-profitability\[plate]\page.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\truck-registry.ts") (Join-Path $workspaceDir "src\features\deliveries\truck-registry.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\delivery-domain.ts") (Join-Path $workspaceDir "src\features\deliveries\delivery-domain.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\globals.css") (Join-Path $workspaceDir "src\app\globals.css") -Force
Copy-Item (Join-Path $scriptDir "backup\package.json") (Join-Path $workspaceDir "package.json") -Force

Write-Host "Removing added test file..." -ForegroundColor Yellow
$testFile = Join-Path $workspaceDir "src\features\deliveries\truck-management-filtering.test.ts"
if (Test-Path $testFile) { Remove-Item $testFile -Force }

Write-Host "[SUCCESS] Prompt 09 (Truck Management and Filtering Improvements) has been reverted." -ForegroundColor Green

