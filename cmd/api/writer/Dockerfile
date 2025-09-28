FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o writer ./cmd/api/writer

# Use Alpine for the final image
FROM alpine:latest

# Add CA certificates, timezone data and wget for healthcheck
RUN apk --no-cache add ca-certificates tzdata wget

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/writer .

# Copy migrations if needed
COPY --from=builder /app/internal/db/migrations ./internal/db/migrations

# Expose the API port
EXPOSE 8081

# Create script to handle DB connection retries
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'echo "Aguardando o PostgreSQL inicializar (10 segundos)..."' >> /app/entrypoint.sh && \
    echo 'sleep 10' >> /app/entrypoint.sh && \
    echo 'echo "Iniciando o Writer"' >> /app/entrypoint.sh && \
    echo 'exec ./writer' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Run the service with the entrypoint script
CMD ["/app/entrypoint.sh"]