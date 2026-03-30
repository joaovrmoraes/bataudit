FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /seed-anomalies ./cmd/tools/seed-anomalies

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /seed-anomalies .
COPY --from=builder /app/internal/db/migrations ./internal/db/migrations
CMD ["./seed-anomalies"]
