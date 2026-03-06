@echo off
echo Установка зависимостей (если нужно)...
call npm install express
echo.
echo Запуск сервера для сохранения данных...
start "" "http://localhost:3000/login.html"
node server.js
pause
