@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 02-calendar-and-date-filter-improvements
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\.."

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\global-date-range-picker.tsx" "%WORKSPACE_DIR%\src\components\global-date-range-picker.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%\src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%\package.json" >nul

echo Removing new test file...
if exist "%WORKSPACE_DIR%\src\components\global-date-range-picker.test.ts" del /Q "%WORKSPACE_DIR%\src\components\global-date-range-picker.test.ts"

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Calendar and Date Filter Improvements
echo ========================================================
pause

