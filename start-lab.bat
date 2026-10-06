@echo off
rem Riz Lab: one-click start (Windows). Builds if needed, serves dist\ on
rem http://localhost:4173 and opens the browser. Close this window to stop.
setlocal
cd /d "%~dp0"
title Riz Lab

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org ^(while online^), then run this again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run: installing packages ^(needs internet once^)...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)

if not exist "dist\index.html" (
  echo Building the lab...
  call npm run build
  if errorlevel 1 ( pause & exit /b 1 )
)

echo.
echo   Riz Lab is running at http://localhost:4173
echo   Keep this window open. Close it to stop the lab.
echo.
rem Open the browser two seconds after the server starts (set NO_BROWSER=1 to skip).
if not defined NO_BROWSER start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:4173/"
call npx vite preview --port 4173 --strictPort
if errorlevel 1 (
  echo.
  echo Could not start on port 4173. Is the lab already open in another window?
  pause
)
