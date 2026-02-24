@echo off
timeout /t 10 /nobreak > nul
cd /d "C:\driver"
start cmd /k "node server.js"