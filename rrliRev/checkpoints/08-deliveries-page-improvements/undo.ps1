# PowerShell Undo Script for: 08-deliveries-page-improvements
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 08-deliveries-page-improvements" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "Restoring backed-up files..." -ForegroundColor Yellow
Copy-Item (Join-Path $scriptDir "backup\deliveries-page.tsx") (Join-Path $workspaceDir "src\app\(workspace)\deliveries\page.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\sortable-table-header.tsx") (Join-Path $workspaceDir "src\components\sortable-table-header.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\globals.css") (Join-Path $workspaceDir "src\app\globals.css") -Force
Copy-Item (Join-Path $scriptDir "backup\delivery-query.ts") (Join-Path $workspaceDir "src\features\deliveries\delivery-query.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\small-mock-repository.ts") (Join-Path $workspaceDir "src\features\deliveries\small-mock-repository.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\delivery-repository.ts") (Join-Path $workspaceDir "src\features\deliveries\server\delivery-repository.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\package.json") (Join-Path $workspaceDir "package.json") -Force

Write-Host "Removing added test file..." -ForegroundColor Yellow
$testFile = Join-Path $workspaceDir "src\features\deliveries\deliveries-page-improvements.test.ts"
if (Test-Path $testFile) { Remove-Item $testFile -Force }

Write-Host "[SUCCESS] Prompt 08 (Deliveries Page Improvements) has been reverted." -ForegroundColor Green