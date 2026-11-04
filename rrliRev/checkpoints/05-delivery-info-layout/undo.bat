@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 05-delivery-info-layout (Delivery Info Improvements)
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\.."

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\deliveries-page.tsx" "%WORKSPACE_DIR%\src\app\(workspace)\deliveries\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%\src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%\package.json" >nul

echo Removing new files...
if exist "%WORKSPACE_DIR%\src\features\deliveries\delivery-layout.test.ts" del /Q "%WORKSPACE_DIR%\src\features\deliveries\delivery-layout.test.ts"
if exist "%WORKSPACE_DIR%\src\components\delivery-crew-section.tsx" del /Q "%WORKSPACE_DIR%\src\components\delivery-crew-section.tsx"
if exist "%WORKSPACE_DIR%\src\features\deliveries\crew-utils.ts" del /Q "%WORKSPACE_DIR%\src\features\deliveries\crew-utils.ts"

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Delivery Info Improvements
echo ========================================================
pause