# justfile for environment management

# Build the Docker image
build:
    docker build -t app:latest .

# Run development environment (loads .env.dev)
dev:
    @if [ ! -f .env.dev ]; then echo "❌ .env.dev not found"; exit 1; fi
    docker run --rm \
        --name app-dev \
        -i \
        --network host \
        --env-file .env.dev \
        app:latest

# Run production environment (loads .env.prod)
prod:
    @if [ ! -f .env.prod ]; then echo "❌ .env.prod not found"; exit 1; fi
    docker run --rm \
        --name app-prod \
        -i \
        --network host \
        --env-file .env.prod \
        app:latest

# Deploy: merge PR, rebuild, restart
deploy pr:
    gh pr merge {{pr}} --merge && \
    git pull origin main && \
    docker build -t app:latest . && \
    echo "✅ Deployed successfully"

# Stop running containers
stop:
    @docker stop app-dev 2>/dev/null || true
    @docker stop app-prod 2>/dev/null || true

# Show running containers
status:
    @docker ps --filter "name=app-" --format "table {{{{.Names}}}}\t{{{{.Status}}}}\t{{{{.Ports}}}}"
