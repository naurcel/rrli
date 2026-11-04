@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 12-display-truck-picture-in-delivery-info
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\..\"

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\truck-photo.tsx" "%WORKSPACE_DIR%src\components\truck-photo.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\deliveries-page.tsx" "%WORKSPACE_DIR%src\app\(workspace)\deliveries\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\dashboard-page.tsx" "%WORKSPACE_DIR%src\app\(workspace)\dashboard\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%package.json" >nul

echo Removing added test and component files...
if exist "%WORKSPACE_DIR%src\components\delivery-truck-info-section.tsx" del /f /q "%WORKSPACE_DIR%src\components\delivery-truck-info-section.tsx" >nul
if exist "%WORKSPACE_DIR%src\components\truck-photo-storage.ts" del /f /q "%WORKSPACE_DIR%src\components\truck-photo-storage.ts" >nul
if exist "%WORKSPACE_DIR%src\features\deliveries\delivery-truck-picture.test.ts" del /f /q "%WORKSPACE_DIR%src\features\deliveries\delivery-truck-picture.test.ts" >nul

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Display Truck Picture in Delivery Information
echo ========================================================
pause
