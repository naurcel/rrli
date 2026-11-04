@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Reverting: 01-customizable-reports
echo ========================================================

set "SCRIPT_DIR=%~dp0"
set "WORKSPACE_DIR=%SCRIPT_DIR%..\.."

echo Restoring modified files from backup...
copy /Y "%SCRIPT_DIR%backup\page.tsx" "%WORKSPACE_DIR%\src\app\(workspace)\reports\page.tsx" >nul
copy /Y "%SCRIPT_DIR%backup\rbac.ts" "%WORKSPACE_DIR%\src\lib\auth\rbac.ts" >nul
copy /Y "%SCRIPT_DIR%backup\globals.css" "%WORKSPACE_DIR%\src\app\globals.css" >nul
copy /Y "%SCRIPT_DIR%backup\package.json" "%WORKSPACE_DIR%\package.json" >nul

echo Removing new feature files...
if exist "%WORKSPACE_DIR%\src\components\report-customizer-modal.tsx" del /Q "%WORKSPACE_DIR%\src\components\report-customizer-modal.tsx"
if exist "%WORKSPACE_DIR%\src\features\reports" rmdir /S /Q "%WORKSPACE_DIR%\src\features\reports"
if exist "%WORKSPACE_DIR%\src\app\api\reports" rmdir /S /Q "%WORKSPACE_DIR%\src\app\api\reports"

echo.
echo ========================================================
echo [SUCCESS] Reverted prompt: Customizable Company Report Formats
echo ========================================================
pause

