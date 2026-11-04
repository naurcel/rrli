@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 06-login-button-forgot-password
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\.."

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%\src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\page.tsx" "%WORKSPACE_DIR%\src\app\login\page.tsx" >nul

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Login button & Forgot password layout
echo ========================================================
pause
