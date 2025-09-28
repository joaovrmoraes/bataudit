# 🦇 BatAudit

> Lightweight, extensible, and self-hosted auditing for your applications — focused on simplicity, traceability, and privacy.
---
## 📌 What is BatAudit?

**BatAudit** is a self-hosted auditing solution developed in Go with a React web interface. It allows any application (regardless of language) to send logs of user actions, errors, execution times, and other important tracking information in a centralized way.

## 🐳 Running with Docker and Locally

This project supports two execution modes:
1. **Local**: Running services directly on your machine
2. **Docker**: Running services in Docker containers

### Docker Structure

The project uses two Docker Compose files:

- `docker-compose.yml`: Infrastructure only (Redis and PostgreSQL)
- `docker-compose.services.yml`: Infrastructure + services (Writer and Worker)

### Makefile Commands

The Makefile provides several useful commands:

```bash
# List all available commands
make help

# Build Docker images for services
make build-all

# Start infrastructure only (Redis and PostgreSQL)
make run-infra

# Start services only (Writer and Worker)
make run-services

# Start everything (infrastructure + services)
make run-all

# Stop all containers
make stop-all

# Clean Docker images
make clean
```

### Running Locally

#### Windows
```
# Start infrastructure only
docker-compose up -d

# Run Writer
.\run-writer.bat

# Run Worker
.\run-worker.bat
```

#### Linux/Mac
```
# Start infrastructure only
docker-compose up -d

# Run Writer
chmod +x run-writer.sh
./run-writer.sh

# Run Worker
chmod +x run-worker.sh
./run-worker.sh
```

### Execution Options

#### Option 1: Infrastructure Only in Docker
Run `make run-infra` or `docker-compose up -d` to start only Redis and PostgreSQL. Then, run the local scripts `run-writer.bat/sh` and `run-worker.bat/sh` to start the services locally.

#### Option 2: Everything in Docker
Run `make run-all` or `docker-compose -f docker-compose.services.yml up -d` to start the entire stack in Docker.

#### Option 3: Mixed Mode
Run `make run-infra` to start the infrastructure, then start the service containers individually as needed:

```bash
docker-compose -f docker-compose.services.yml up -d writer
docker-compose -f docker-compose.services.yml up -d worker
```

### Containers

- **Redis**: Available at `localhost:6379`
- **PostgreSQL**: Available at `localhost:5432`
- **Writer API**: Available at `localhost:8081`
- **Worker**: Automatically processes events from the Redis queue

### Notes

- Containers use Alpine images for reduced size
- Environment settings can be changed in the scripts or docker-compose files
- Compilation uses optimizations for size reduction