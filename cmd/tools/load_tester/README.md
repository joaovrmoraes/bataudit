# BatAudit Load Testing Tool

This tool allows you to perform load tests on the BatAudit system by sending multiple events to the Redis queue.

## Structure

- `main.go` - Source code of the testing tool
- `scripts/` - Scripts for running the test
  - `run_test.bat` - Script for Windows
  - `run_test.sh` - Script for Linux/macOS

## How to Use

### Windows

```
cd scripts
.\run_test.bat
```

### Linux/macOS

```
cd scripts
chmod +x run_test.sh
./run_test.sh
```

## Test Options

The tool offers different levels of testing:

1. **Light Test**: 100 requests, 10 concurrent
2. **Medium Test**: 500 requests, 20 concurrent
3. **Heavy Test**: 1000 requests, 30 concurrent
4. **Custom Test**: User-defined values

## Configurable Parameters

- **Requests**: Total number of events to be sent
- **Concurrency**: Number of concurrent goroutines
- **Interval**: Time between batches of requests
- **Redis**: Redis server address
- **Queue**: Name of the queue for sending events

## Manual Compilation

To manually compile the tool:

```
cd ../../..  # Go back to the project root
mkdir -p bin
go build -o bin/load_tester ./cmd/tools/load_tester/main.go
```

The compiled binary will be saved in the `bin/` folder at the project root.