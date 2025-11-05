@echo off
echo Iniciando servidor HTTP na porta 8000...
echo Acesse: http://localhost:8000/
echo Pressione Ctrl+C para parar o servidor
echo.
cd /d "%~dp0"
python -m http.server 8000
pause

