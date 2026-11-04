@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 04-audit-log-ui (Audit Log UI Improvements)
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\.."

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\user-management-page.tsx" "%WORKSPACE_DIR%\src\app\(workspace)\user-management\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%\src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%\package.json" >nul

echo Removing new files...
if exist "%WORKSPACE_DIR%\src\features\audit\audit-ui.test.ts" del /Q "%WORKSPACE_DIR%\src\features\audit\audit-ui.test.ts"
if exist "%WORKSPACE_DIR%\src\components\audit-state-changes.tsx" del /Q "%WORKSPACE_DIR%\src\components\audit-state-changes.tsx"
if exist "%WORKSPACE_DIR%\src\features\audit\audit-formatters.ts" del /Q "%WORKSPACE_DIR%\src\features\audit\audit-formatters.ts"

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Audit Log UI Improvements
echo ========================================================
pause

