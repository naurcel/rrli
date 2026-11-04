# PowerShell Undo Script for: 01-customizable-reports
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Reverting: 01-customizable-reports (Customizable Reports)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = Resolve-Path (Join-Path $scriptDir "..\..")

Write-Host "Restoring backed-up files..." -ForegroundColor Yellow
Copy-Item (Join-Path $scriptDir "backup\page.tsx") (Join-Path $workspaceDir "src\app\(workspace)\reports\page.tsx") -Force
Copy-Item (Join-Path $scriptDir "backup\rbac.ts") (Join-Path $workspaceDir "src\lib\auth\rbac.ts") -Force
Copy-Item (Join-Path $scriptDir "backup\globals.css") (Join-Path $workspaceDir "src\app\globals.css") -Force
Copy-Item (Join-Path $scriptDir "backup\package.json") (Join-Path $workspaceDir "package.json") -Force

Write-Host "Removing newly added files..." -ForegroundColor Yellow
$customizerModal = Join-Path $workspaceDir "src\components\report-customizer-modal.tsx"
if (Test-Path $customizerModal) { Remove-Item $customizerModal -Force }

$reportsFeature = Join-Path $workspaceDir "src\features\reports"
if (Test-Path $reportsFeature) { Remove-Item $reportsFeature -Recurse -Force }

$reportsApi = Join-Path $workspaceDir "src\app\api\reports"
if (Test-Path $reportsApi) { Remove-Item $reportsApi -Recurse -Force }

Write-Host "[SUCCESS] Prompt 01 (Customizable Company Report Formats) has been reverted." -ForegroundColor Green

