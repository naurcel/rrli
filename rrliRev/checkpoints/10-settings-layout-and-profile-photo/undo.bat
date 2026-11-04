@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 10-settings-layout-and-profile-photo
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\..\"

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\settings-page.tsx" "%WORKSPACE_DIR%src\app\(workspace)\settings\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\account-control.tsx" "%WORKSPACE_DIR%src\components\account-control.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\operational-topbar.tsx" "%WORKSPACE_DIR%src\components\operational-topbar.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\server-account-store.ts" "%WORKSPACE_DIR%src\lib\auth\server-account-store.ts" >nul
copy /Y "%SCRIPT_DIR%backup\server-session.ts" "%WORKSPACE_DIR%src\lib\auth\server-session.ts" >nul
copy /Y "%SCRIPT_DIR%backup\account-route.ts" "%WORKSPACE_DIR%src\app\api\auth\account\route.ts" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%package.json" >nul

echo Removing added test and helper files...
if exist "%WORKSPACE_DIR%src\features\users\settings-profile-photo.test.ts" del /f /q "%WORKSPACE_DIR%src\features\users\settings-profile-photo.test.ts" >nul
if exist "%WORKSPACE_DIR%src\components\profile-photo.ts" del /f /q "%WORKSPACE_DIR%src\components\profile-photo.ts" >nul
if exist "%WORKSPACE_DIR%src\components\profile-photo.tsx" del /f /q "%WORKSPACE_DIR%src\components\profile-photo.tsx" >nul

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Settings Page Layout and Profile Photo
echo ========================================================
pause
