## Stage 1: build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline
COPY frontend/ .
RUN npm run build

## Stage 2: build the Go binary
FROM golang:1.24-alpine AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o reader ./cmd/api/reader

## Stage 3: minimal runtime image
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata wget
WORKDIR /app
COPY --from=go-builder /app/reader .
COPY --from=go-builder /app/internal/db/migrations ./internal/db/migrations
COPY --from=frontend-builder /frontend/dist ./frontend/dist
EXPOSE 8082
HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD wget -qO- http://localhost:8082/health || exit 1
CMD ["./reader"]
