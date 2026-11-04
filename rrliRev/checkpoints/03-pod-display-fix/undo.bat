@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 03-pod-display-fix
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\.."

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\route.ts" "%WORKSPACE_DIR%\src\app\api\deliveries\documents\route.ts" >nul
copy /Y "%SCRIPT_DIR%backup\delivery-pod-documents.tsx" "%WORKSPACE_DIR%\src\components\delivery-pod-documents.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\deliveries-page.tsx" "%WORKSPACE_DIR%\src\app\(workspace)\deliveries\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\pod-documents-page.tsx" "%WORKSPACE_DIR%\src\app\(workspace)\pod-documents\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%\src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%\package.json" >nul

echo Removing new test and utility files...
if exist "%WORKSPACE_DIR%\src\features\deliveries\pod-display.test.ts" del /Q "%WORKSPACE_DIR%\src\features\deliveries\pod-display.test.ts"
if exist "%WORKSPACE_DIR%\src\features\deliveries\pod-utils.ts" del /Q "%WORKSPACE_DIR%\src\features\deliveries\pod-utils.ts"

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: POD Display Fix
echo ========================================================
pause