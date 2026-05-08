@echo off
title AppSchleppen - Dev Server
echo.
echo  ================================================
echo   AppSchleppen - Lokaler Entwicklungsserver
echo  ================================================
echo.

cd /d "%~dp0"

:: Pruefe ob node_modules vorhanden
if not exist "node_modules\" (
    echo [INFO] node_modules nicht gefunden. Installiere Abhaengigkeiten...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [FEHLER] npm install fehlgeschlagen. Bitte Node.js installieren:
        echo         https://nodejs.org
        pause
        exit /b 1
    )
    echo.
)

:: Pruefe ob .env.local existiert
if not exist ".env.local" (
    echo [WARNUNG] .env.local nicht gefunden.
    echo           Webhook und API-Keys koennen fehlen.
    echo.
)

echo [INFO] Starte Server auf http://localhost:3000
echo [INFO] Strg+C zum Beenden
echo.
call npm run dev
pause
