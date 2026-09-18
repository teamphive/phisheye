set shell := ["bash", "-uc"]

[private]
default:
    just --list

# starts infra (compose), backend, worker and frontend in one terminal, Ctrl+C stops all but compose
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    docker compose up -d
    uv run --directory backend uvicorn app.main:app --reload &
    api=$!
    uv run --directory backend arq app.worker.settings.WorkerSettings &
    worker=$!
    frontend/node_modules/.bin/vite frontend &
    web=$!
    trap 'kill $api $worker $web 2>/dev/null' SIGINT SIGTERM EXIT
    wait
