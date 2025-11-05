# Script para iniciar servidor HTTP local
Write-Host "Iniciando servidor HTTP na porta 8000..." -ForegroundColor Green
Write-Host "Acesse: http://localhost:8000/" -ForegroundColor Yellow
Write-Host "Pressione Ctrl+C para parar o servidor" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot
python -m http.server 8000

