# PowerShell Undo Script for 11-delivery-breakdown-ui-and-visualization
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 11-delivery-breakdown-ui-and-visualization" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceDir = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path

Write-Host "Restoring modified files from backup..." -ForegroundColor Yellow
Copy-Item -Path (Join-Path $ScriptDir "backup\deliveries-page.tsx") -Destination (Join-Path $WorkspaceDir "src\app\(workspace)\deliveries\page.tsx") -Force
Copy-Item -Path (Join-Path $ScriptDir "backup\dashboard-page.tsx") -Destination (Join-Path $WorkspaceDir "src\app\(workspace)\dashboard\page.tsx") -Force
Copy-Item -Path (Join-Path $ScriptDir "backup\globals.css") -Destination (Join-Path $WorkspaceDir "src\app\globals.css") -Force
Copy-Item -Path (Join-Path $ScriptDir "backup\package.json") -Destination (Join-Path $WorkspaceDir "package.json") -Force

Write-Host "Removing added test and component files..." -ForegroundColor Yellow
$componentPath = Join-Path $WorkspaceDir "src\components\delivery-financial-breakdown.tsx"
if (Test-Path $componentPath) {
    Remove-Item -Path $componentPath -Force
}
$testPath = Join-Path $WorkspaceDir "src\features\deliveries\delivery-breakdown-visualization.test.ts"
if (Test-Path $testPath) {
    Remove-Item -Path $testPath -Force
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "[SUCCESS] Reverted prompt: Delivery Breakdown UI and Visualization Improvements" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

