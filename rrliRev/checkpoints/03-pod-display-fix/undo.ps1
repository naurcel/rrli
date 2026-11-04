# PowerShell Undo Script for: 03-pod-display-fix
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 03-pod-display-fix (POD Display Fix)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "Restoring backed-up files..." -ForegroundColor Yellow
Copy-Item (Join-Path $scriptDir "backup\route.ts") (Join-Path $workspaceDir "src\app\api\deliveries\documents\route.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\delivery-pod-documents.tsx") (Join-Path $workspaceDir "src\components\delivery-pod-documents.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\deliveries-page.tsx") (Join-Path $workspaceDir "src\app\(workspace)\deliveries\page.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\pod-documents-page.tsx") (Join-Path $workspaceDir "src\app\(workspace)\pod-documents\page.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\globals.css") (Join-Path $workspaceDir "src\app\globals.css") -Force
Copy-Item (Join-Path $scriptDir "backup\package.json") (Join-Path $workspaceDir "package.json") -Force

Write-Host "Removing newly added files..." -ForegroundColor Yellow
$testFile = Join-Path $workspaceDir "src\features\deliveries\pod-display.test.ts"
if (Test-Path $testFile) { Remove-Item $testFile -Force }
$utilsFile = Join-Path $workspaceDir "src\features\deliveries\pod-utils.ts"
if (Test-Path $utilsFile) { Remove-Item $utilsFile -Force }

Write-Host "[SUCCESS] Prompt 03 (POD Display Fix) has been reverted." -ForegroundColor Green