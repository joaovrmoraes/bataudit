@echo off
REM Configuração de ambiente para o Writer

set DB_DRIVER=postgres
set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=batuser
set DB_PASSWORD=batpassword
set DB_NAME=batdb
set REDIS_ADDRESS=localhost:6379
set API_WRITER_PORT=8081

echo Ambiente configurado para o Writer
echo Executando writer...
go run cmd/api/writer/main.go