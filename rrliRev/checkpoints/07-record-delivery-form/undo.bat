@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 07-record-delivery-form
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\.."

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\page.tsx" "%WORKSPACE_DIR%\src\app\(workspace)\deliveries\new\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\route.ts" "%WORKSPACE_DIR%\src\app\api\deliveries\route.ts" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%\src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%\package.json" >nul

echo Removing new files...
if exist "%WORKSPACE_DIR%\src\features\deliveries\delivery-form.test.ts" del /Q "%WORKSPACE_DIR%\src\features\deliveries\delivery-form.test.ts"

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Record Delivery Form Improvements
echo ========================================================
pause

