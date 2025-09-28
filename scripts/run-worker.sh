#!/bin/bash
# Configuração de ambiente para o Worker

export DB_DRIVER=postgres
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=batuser
export DB_PASSWORD=batpassword
export DB_NAME=batdb
export REDIS_ADDRESS=localhost:6379
export WORKER_MIN_COUNT=2
export WORKER_MAX_COUNT=10

echo "Ambiente configurado para o Worker"
echo "Executando worker..."
go run cmd/api/worker/main.go