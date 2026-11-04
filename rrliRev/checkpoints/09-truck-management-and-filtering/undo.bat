@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 09-truck-management-and-filtering
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\..\"

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\truck-profitability-page.tsx" "%WORKSPACE_DIR%src\app\(workspace)\truck-profitability\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\truck-profitability-detail-page.tsx" "%WORKSPACE_DIR%src\app\(workspace)\truck-profitability\[plate]\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\truck-registry.ts" "%WORKSPACE_DIR%src\features\deliveries\truck-registry.ts" >nul
copy /Y "%SCRIPT_DIR%backup\delivery-domain.ts" "%WORKSPACE_DIR%src\features\deliveries\delivery-domain.ts" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%package.json" >nul

echo Removing added test file...
if exist "%WORKSPACE_DIR%src\features\deliveries\truck-management-filtering.test.ts" del /f /q "%WORKSPACE_DIR%src\features\deliveries\truck-management-filtering.test.ts" >nul

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Truck Management and Filtering Improvements
echo ========================================================
pause

