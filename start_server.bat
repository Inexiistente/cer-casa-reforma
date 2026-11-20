@echo off
title CeR Casa e Reforma - Servidor ERP Live Sync
cd /d "%~dp0"
set PYTHON="c:\Users\Usuario\Desktop\Automacoes Pessoais\Projetos Open Router\centauro-sync\.venv\Scripts\python.exe"
echo Iniciando CeR Casa e Reforma com sincronizacao ao vivo do ERP CentauroCloud...
%PYTHON% erp_server.py
pause
