@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js is required. Install Node.js 18+ and run this again.&pause&exit /b 1)
if not exist "backend\node_modules" (
  echo Installing backend dependencies...
  call npm install --prefix backend || goto :error
)
if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  call npm install --prefix frontend || goto :error
)
echo.
echo Starting Hospital Consult Scribe...
echo Backend: http://localhost:8787
call npm run dev
goto :eof
:error
echo.
echo Dependency installation failed. Check your internet connection and npm output.
pause
exit /b 1
