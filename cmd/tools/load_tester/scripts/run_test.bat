@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo BatAudit - Load Test Tool
echo ==============================================

:: Check current directory and navigate to project root
cd /d %~dp0\..\..\..\..\

:: Check if needs to build
if not exist "bin\load_tester.exe" (
    echo Creating bin directory if it does not exist...
    if not exist "bin" mkdir bin
    
    echo Building load test tool...
    go build -o bin\load_tester.exe .\cmd\tools\load_tester
    if !errorlevel! neq 0 (
        echo Error building the tool.
        exit /b !errorlevel!
    )
    echo Tool built successfully.
    echo.
)

:: Test options menu
echo Select test type:
echo 1 - Light test (100 requests)
echo 2 - Medium test (500 requests)
echo 3 - Heavy test (1000 requests)
echo 4 - Custom test
echo 5 - Exit

set /p opcao="Option: "

:: Select mode
echo.
echo Select test mode:
echo 1 - API mode (send to API endpoint)
echo 2 - Redis mode (send directly to Redis queue)

set /p mode_option="Mode: "
if "%mode_option%"=="1" (
    set MODE=api
    set API=http://localhost:8081/audit
) else if "%mode_option%"=="2" (
    set MODE=redis
) else (
    set MODE=api
    set API=http://localhost:8081/audit
    echo Invalid mode option, defaulting to API mode.
)

:: Set default parameters
set REDIS=localhost:6379
set QUEUE=bataudit:events

:: Process selected option
if "%opcao%"=="1" (
    set REQUESTS=100
    set CONCURRENCY=10
    set INTERVAL=100ms
    echo Running light test...
) else if "%opcao%"=="2" (
    set REQUESTS=500
    set CONCURRENCY=20
    set INTERVAL=50ms
    echo Running medium test...
) else if "%opcao%"=="3" (
    set REQUESTS=1000
    set CONCURRENCY=30
    set INTERVAL=20ms
    echo Running heavy test...
) else if "%opcao%"=="4" (
    echo.
    set /p REQUESTS="Number of requests (ex: 200): "
    set /p CONCURRENCY="Concurrency (ex: 10): "
    set /p INTERVAL="Interval in ms (ex: 50): "
    set INTERVAL=!INTERVAL!ms
    echo Running custom test...
) else if "%opcao%"=="5" (
    echo Exiting...
    exit /b 0
) else (
    echo Invalid option.
    exit /b 1
)

:: Show test settings
echo.
echo Test parameters:
echo - Requests: %REQUESTS%
echo - Concurrency: %CONCURRENCY%
echo - Interval: %INTERVAL%
echo - Mode: %MODE%
if "%MODE%"=="api" (
    echo - API URL: %API%
) else (
    echo - Redis: %REDIS%
    echo - Queue: %QUEUE%
)
echo.

:: Confirm execution
set /p confirmacao="Do you want to start the test? (Y/N): "
if /i "%confirmacao%" neq "Y" (
    echo Test cancelled by user.
    exit /b 0
)

:: Run the test
echo.
echo Starting load test...
echo.

if "%MODE%"=="api" (
    bin\load_tester.exe -requests=%REQUESTS% -concurrency=%CONCURRENCY% -interval=%INTERVAL% -mode=api -api=%API%
) else (
    bin\load_tester.exe -requests=%REQUESTS% -concurrency=%CONCURRENCY% -interval=%INTERVAL% -mode=redis -redis=%REDIS% -queue=%QUEUE%
)

echo.
echo Load test completed.
echo ==============================================

endlocal