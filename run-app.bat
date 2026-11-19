@echo off
set "PATH=C:\Users\welba\AppData\Roaming\fnm\node-versions\v22.14.0\installation;C:\Users\welba\AppData\Roaming\npm;%PATH%"
cd /d "%~dp0"
echo ========================================================
echo        Starting Rakez AI - Focus Guardian Cockpit
echo ========================================================
echo Building modern React UI and launching Electron...
call npm run build:renderer
call npx electron . --no-sandbox
