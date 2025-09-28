#!/bin/bash

echo "=============================================="
echo "BatAudit - Load Testing Tool"
echo "=============================================="

# Navigate to the project root directory
cd "$(dirname "$0")"/../../../../

# Check if compilation is needed
if [ ! -f "./bin/load_tester" ]; then
    echo "Creating bin directory if it doesn't exist..."
    mkdir -p bin
    
    echo "Compiling load testing tool..."
    go build -o bin/load_tester ./cmd/tools/load_tester
    if [ $? -ne 0 ]; then
        echo "Error compiling the tool."
        exit 1
    fi
    echo "Tool compiled successfully."
    echo ""
fi

# Test options menu
echo "Select the test type:"
echo "1 - Light test (100 requests)"
echo "2 - Medium test (500 requests)"
echo "3 - Heavy test (1000 requests)"
echo "4 - Custom test"
echo "5 - Exit"

read -p "Option: " option

# Select mode
echo ""
echo "Select test mode:"
echo "1 - API mode (send to API endpoint)"
echo "2 - Redis mode (send directly to Redis queue)"

read -p "Mode: " mode_option
if [ "$mode_option" = "1" ]; then
    MODE="api"
    API="http://localhost:8081/audit"
elif [ "$mode_option" = "2" ]; then
    MODE="redis"
else
    MODE="api"
    API="http://localhost:8081/audit"
    echo "Invalid mode option, defaulting to API mode."
fi

# Set default parameters
REDIS="localhost:6379"
QUEUE="bataudit:events"

# Process selected option
case $option in
    1)
        REQUESTS=100
        CONCURRENCY=10
        INTERVAL="100ms"
        echo "Running light test..."
        ;;
    2)
        REQUESTS=500
        CONCURRENCY=20
        INTERVAL="50ms"
        echo "Running medium test..."
        ;;
    3)
        REQUESTS=1000
        CONCURRENCY=30
        INTERVAL="20ms"
        echo "Running heavy test..."
        ;;
    4)
        echo ""
        read -p "Number of requests (e.g.: 200): " REQUESTS
        read -p "Concurrency (e.g.: 10): " CONCURRENCY
        read -p "Interval in ms (e.g.: 50): " interval_ms
        INTERVAL="${interval_ms}ms"
        echo "Running custom test..."
        ;;
    5)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option."
        exit 1
        ;;
esac

# Show test settings
echo ""
echo "Test parameters:"
echo "- Requests: $REQUESTS"
echo "- Concurrency: $CONCURRENCY"
echo "- Interval: $INTERVAL"
echo "- Mode: $MODE"
if [ "$MODE" = "api" ]; then
    echo "- API URL: $API"
else
    echo "- Redis: $REDIS"
    echo "- Queue: $QUEUE"
fi
echo ""

# Confirm execution
read -p "Do you want to start the test? (Y/N): " confirmation
if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
    echo "Test cancelled by user."
    exit 0
fi

# Run the test
echo ""
echo "Starting load test..."
echo ""

if [ "$MODE" = "api" ]; then
    ./bin/load_tester -requests=$REQUESTS -concurrency=$CONCURRENCY -interval=$INTERVAL -mode=api -api=$API
else
    ./bin/load_tester -requests=$REQUESTS -concurrency=$CONCURRENCY -interval=$INTERVAL -mode=redis -redis=$REDIS -queue=$QUEUE
fi

echo ""
echo "Load test completed."
echo "=============================================="