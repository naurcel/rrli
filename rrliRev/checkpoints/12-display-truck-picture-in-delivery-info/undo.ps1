# PowerShell Undo Script for 12-display-truck-picture-in-delivery-info
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 12-display-truck-picture-in-delivery-info" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceDir = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path

Write-Host "Restoring modified files from backup..." -ForegroundColor Yellow
Copy-Item -Path (Join-Path $ScriptDir "backup\truck-photo.tsx") -Destination (Join-Path $WorkspaceDir "src\components\truck-photo.tsx") -Force
Copy-Item -Path (Join-Path $ScriptDir "backup\deliveries-page.tsx") -Destination (Join-Path $WorkspaceDir "src\app\(workspace)\deliveries\page.tsx") -Force
Copy-Item -Path (Join-Path $ScriptDir "backup\dashboard-page.tsx") -Destination (Join-Path $WorkspaceDir "src\app\(workspace)\dashboard\page.tsx") -Force
Copy-Item -Path (Join-Path $ScriptDir "backup\globals.css") -Destination (Join-Path $WorkspaceDir "src\app\globals.css") -Force
Copy-Item -Path (Join-Path $ScriptDir "backup\package.json") -Destination (Join-Path $WorkspaceDir "package.json") -Force

Write-Host "Removing added test and component files..." -ForegroundColor Yellow
$componentPath = Join-Path $WorkspaceDir "src\components\delivery-truck-info-section.tsx"
if (Test-Path $componentPath) {
    Remove-Item -Path $componentPath -Force
}
$storageUtilPath = Join-Path $WorkspaceDir "src\components\truck-photo-storage.ts"
if (Test-Path $storageUtilPath) {
    Remove-Item -Path $storageUtilPath -Force
}
$testPath = Join-Path $WorkspaceDir "src\features\deliveries\delivery-truck-picture.test.ts"
if (Test-Path $testPath) {
    Remove-Item -Path $testPath -Force
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "[SUCCESS] Reverted prompt: Display Truck Picture in Delivery Information" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
