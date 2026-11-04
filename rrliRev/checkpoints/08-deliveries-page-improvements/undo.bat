@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 08-deliveries-page-improvements
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\..\"

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\deliveries-page.tsx" "%WORKSPACE_DIR%src\app\(workspace)\deliveries\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\sortable-table-header.tsx" "%WORKSPACE_DIR%src\components\sortable-table-header.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\delivery-query.ts" "%WORKSPACE_DIR%src\features\deliveries\delivery-query.ts" >nul
copy /Y "%SCRIPT_DIR%backup\small-mock-repository.ts" "%WORKSPACE_DIR%src\features\deliveries\small-mock-repository.ts" >nul
copy /Y "%SCRIPT_DIR%backup\delivery-repository.ts" "%WORKSPACE_DIR%src\features\deliveries\server\delivery-repository.ts" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%package.json" >nul

echo Removing added test file...
if exist "%WORKSPACE_DIR%src\features\deliveries\deliveries-page-improvements.test.ts" del /f /q "%WORKSPACE_DIR%src\features\deliveries\deliveries-page-improvements.test.ts" >nul

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Deliveries Page Improvements
echo ========================================================
pause