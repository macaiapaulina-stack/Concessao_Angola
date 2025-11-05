@echo off
setlocal enableextensions enabledelayedexpansion

:: Caminho do repositório remoto (altere se necessário)
set "REPO_URL=https://github.com/macaiapaulina-stack/Concessao_Angola.git"

echo Publicando WebGIS para %REPO_URL%
echo.

:: Ir para a pasta deste script
cd /d "%~dp0"

:: Verifica se git existe
where git >nul 2>nul
if errorlevel 1 (
  echo ERRO: Git nao encontrado. Instale o Git e tente de novo: https://git-scm.com/download/win
  pause
  exit /b 1
)

:: Inicializa repositório (se ainda nao existir)
if not exist .git (
  git init
)

:: Define usuario se ainda não configurado (opcional, com fallback simples)
for /f "tokens=* delims=" %%a in ('git config user.name') do set GUN=%%a
if "%GUN%"=="" (
  git config user.name "macaiapaulina"
)
for /f "tokens=* delims=" %%a in ('git config user.email') do set GUEM=%%a
if "%GUEM%"=="" (
  git config user.email "no-reply@example.com"
)

:: Adiciona arquivos e faz commit
git add -A
git commit -m "Publicar WebGIS" 2>nul

:: Configura branch principal
git branch -M main

:: Configura remoto origin
git remote remove origin 2>nul
git remote add origin %REPO_URL%

:: Envia para o GitHub
git push -u origin main

echo.
echo Concluido. Verifique o repositório no GitHub: %REPO_URL%
echo Se o Pages via branch estiver desativado, usaremos GitHub Actions automaticamente (próximo passo).
pause


