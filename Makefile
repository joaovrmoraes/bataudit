# BatAudit Makefile

.PHONY: build-writer build-worker build-all run-infra run-services run-all stop-all clean help rebuild-writer rebuild-worker rebuild-all logs-writer logs-worker logs-postgres logs-redis

# Variáveis
DOCKER_COMPOSE = docker-compose
INFRA_FILE = docker-compose.yml
SERVICES_FILE = docker-compose.services.yml
WRITER_IMG = bataudit-writer:latest
WORKER_IMG = bataudit-worker:latest

# Build Writer image
build-writer:
	@echo "Building Writer Docker image..."
	docker build -t $(WRITER_IMG) -f cmd/api/writer/Dockerfile .

# Build Worker image
build-worker:
	@echo "Building Worker Docker image..."
	docker build -t $(WORKER_IMG) -f cmd/api/worker/Dockerfile .

# Build all images
build-all: build-writer build-worker
	@echo "All Docker images built successfully."

# Run only infrastructure (Redis and PostgreSQL)
run-infra:
	@echo "Starting infrastructure containers (Redis and PostgreSQL)..."
	$(DOCKER_COMPOSE) -f $(INFRA_FILE) up -d
	@echo "Infrastructure containers started. PostgreSQL: localhost:5432, Redis: localhost:6379"

# Run services (Writer and Worker) with existing infrastructure
run-services:
	@echo "Starting services containers (Writer and Worker)..."
	$(DOCKER_COMPOSE) -f $(SERVICES_FILE) up -d writer worker
	@echo "Services started. Writer API available at: http://localhost:8081"

# Run both infrastructure and services
run-all:
	@echo "Starting all containers..."
	$(DOCKER_COMPOSE) -f $(SERVICES_FILE) up -d
	@echo "All containers started. Writer API available at: http://localhost:8081"

# Stop and remove all containers
stop-all:
	@echo "Stopping all containers..."
	$(DOCKER_COMPOSE) -f $(INFRA_FILE) down
	$(DOCKER_COMPOSE) -f $(SERVICES_FILE) down
	@echo "All containers stopped."

# Clean all Docker images
clean: stop-all
	@echo "Removing Docker images..."
	docker rmi $(WRITER_IMG) $(WORKER_IMG) || true
	@echo "Docker images removed."

# Rebuild writer image and restart the service
rebuild-writer: 
	@echo "Rebuilding Writer..."
	docker-compose -f $(SERVICES_FILE) stop writer
	docker-compose -f $(SERVICES_FILE) rm -f writer
	docker rmi $(WRITER_IMG) || true
	docker-compose -f $(SERVICES_FILE) build writer
	docker-compose -f $(SERVICES_FILE) up -d writer
	@echo "Writer has been rebuilt and restarted."

# Rebuild worker image and restart the service
rebuild-worker: 
	@echo "Rebuilding Worker..."
	docker-compose -f $(SERVICES_FILE) stop worker
	docker-compose -f $(SERVICES_FILE) rm -f worker
	docker rmi $(WORKER_IMG) || true
	docker-compose -f $(SERVICES_FILE) build worker
	docker-compose -f $(SERVICES_FILE) up -d worker
	@echo "Worker has been rebuilt and restarted."

# Rebuild all images and restart services
rebuild-all: 
	@echo "Rebuilding all services..."
	docker-compose -f $(SERVICES_FILE) stop writer worker
	docker-compose -f $(SERVICES_FILE) rm -f writer worker
	docker rmi $(WRITER_IMG) $(WORKER_IMG) || true
	docker-compose -f $(SERVICES_FILE) build writer worker
	docker-compose -f $(SERVICES_FILE) up -d writer worker
	@echo "All services have been rebuilt and restarted."

# Log commands
logs-writer:
	@echo "Showing Writer logs..."
	docker logs -f bat_writer

logs-worker:
	@echo "Showing Worker logs..."
	docker logs -f bat_worker

logs-postgres:
	@echo "Showing PostgreSQL logs..."
	docker logs -f bat_postgres

logs-redis:
	@echo "Showing Redis logs..."
	docker logs -f bat_redis

# Help command
help:
	@echo "BatAudit Makefile commands:"
	@echo "  make build-writer    - Build Writer Docker image"
	@echo "  make build-worker    - Build Worker Docker image"
	@echo "  make build-all       - Build all Docker images"
	@echo "  make run-infra       - Run only infrastructure containers (Redis, PostgreSQL)"
	@echo "  make run-services    - Run only service containers (Writer, Worker)"
	@echo "  make run-all         - Run all containers"
	@echo "  make stop-all        - Stop all containers"
	@echo "  make clean           - Remove all containers and images"
	@echo "  make rebuild-writer  - Rebuild and restart Writer service"
	@echo "  make rebuild-worker  - Rebuild and restart Worker service"
	@echo "  make rebuild-all     - Rebuild and restart all services"
	@echo "  make logs-writer     - Show Writer container logs"
	@echo "  make logs-worker     - Show Worker container logs"
	@echo "  make logs-postgres   - Show PostgreSQL container logs"
	@echo "  make logs-redis      - Show Redis container logs"
	@echo "  make help            - Show this help message"

# Default target
default: help