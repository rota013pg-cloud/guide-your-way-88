@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "BRANCH=main"
set "LOG=deploy-log.txt"

echo ==================================================
echo    FORCAR NOVO DEPLOY NA VERCEL
echo    (cria um commit vazio so pra disparar o build)
echo ==================================================
echo.
echo (Salvando relatorio em %LOG% ...)
echo.

> "%LOG%" echo ===== FORCAR DEPLOY =====
>> "%LOG%" echo Data: %date% %time%
>> "%LOG%" echo.

>> "%LOG%" echo --- git log origin/%BRANCH% (ultimo commit ANTES) ---
git log --oneline -1 origin/%BRANCH% >> "%LOG%" 2>&1
>> "%LOG%" echo.

echo Criando commit vazio...
>> "%LOG%" echo --- git commit --allow-empty ---
git commit --allow-empty -m "chore: forcar novo deploy (rebuild do main atual)" >> "%LOG%" 2>&1
>> "%LOG%" echo.

echo Enviando para o GitHub (a Vercel deve buildar sozinha)...
>> "%LOG%" echo --- git push origin %BRANCH% ---
git push origin %BRANCH% >> "%LOG%" 2>&1
set "PUSH_ERR=%errorlevel%"
>> "%LOG%" echo (codigo de saida do push: %PUSH_ERR%)
>> "%LOG%" echo.

if not "%PUSH_ERR%"=="0" (
  echo.
  echo ==================================================
  echo    ERRO no push. Veja o arquivo %LOG%
  echo ==================================================
  >> "%LOG%" echo ===== RESULTADO: FALHOU no push =====
  goto FIM
)

echo.
echo ==================================================
echo    SUCESSO! Push enviado.
echo    Atualize a aba Deployments da Vercel:
echo    deve aparecer um build novo (Building -^> Ready).
echo ==================================================
>> "%LOG%" echo ===== RESULTADO: SUCESSO =====

:FIM
>> "%LOG%" echo ===== FIM =====
echo.
pause
