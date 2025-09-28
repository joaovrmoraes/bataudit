@echo off
REM Configuração de ambiente para o Worker

set DB_DRIVER=postgres
set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=batuser
set DB_PASSWORD=batpassword
set DB_NAME=batdb
set REDIS_ADDRESS=localhost:6379
set WORKER_MIN_COUNT=2
set WORKER_MAX_COUNT=10

echo Ambiente configurado para o Worker
echo Executando worker...
go run cmd/api/worker/main.go