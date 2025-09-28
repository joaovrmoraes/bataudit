#!/bin/bash
# Configuração de ambiente para o Writer

export DB_DRIVER=postgres
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=batuser
export DB_PASSWORD=batpassword
export DB_NAME=batdb
export REDIS_ADDRESS=localhost:6379
export API_WRITER_PORT=8081

echo "Ambiente configurado para o Writer"
echo "Executando writer..."
go run cmd/api/writer/main.go