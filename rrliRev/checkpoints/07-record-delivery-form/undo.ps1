# PowerShell Undo Script for: 07-record-delivery-form
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 07-record-delivery-form (Record Delivery Improvements)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "Restoring backed-up files..." -ForegroundColor Yellow
Copy-Item (Join-Path $scriptDir "backup\page.tsx") (Join-Path $workspaceDir "src\app\(workspace)\deliveries\new\page.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\route.ts") (Join-Path $workspaceDir "src\app\api\deliveries\route.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\globals.css") (Join-Path $workspaceDir "src\app\globals.css") -Force
Copy-Item (Join-Path $scriptDir "backup\package.json") (Join-Path $workspaceDir "package.json") -Force

Write-Host "Removing newly added files..." -ForegroundColor Yellow
$testFile = Join-Path $workspaceDir "src\features\deliveries\delivery-form.test.ts"
if (Test-Path $testFile) { Remove-Item $testFile -Force }

Write-Host "[SUCCESS] Prompt 07 (Record Delivery Improvements) has been reverted." -ForegroundColor Green

