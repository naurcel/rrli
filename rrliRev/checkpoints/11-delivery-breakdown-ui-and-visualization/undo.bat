@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 11-delivery-breakdown-ui-and-visualization
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\..\"

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\deliveries-page.tsx" "%WORKSPACE_DIR%src\app\(workspace)\deliveries\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\dashboard-page.tsx" "%WORKSPACE_DIR%src\app\(workspace)\dashboard\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%package.json" >nul

echo Removing added test and component files...
if exist "%WORKSPACE_DIR%src\components\delivery-financial-breakdown.tsx" del /f /q "%WORKSPACE_DIR%src\components\delivery-financial-breakdown.tsx" >nul
if exist "%WORKSPACE_DIR%src\features\deliveries\delivery-breakdown-visualization.test.ts" del /f /q "%WORKSPACE_DIR%src\features\deliveries\delivery-breakdown-visualization.test.ts" >nul

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Delivery Breakdown UI and Visualization Improvements
echo ========================================================
pause

