#!/usr/bin/env bash
# opencode-orchestrator installer
set -euo pipefail

# Check and install system dependencies (Docker, Git, Curl)
ensure_dependencies() {
  local missing=()
  for cmd in docker git curl; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done

  if [ ${#missing[@]} -eq 0 ]; then
    return 0
  fi

  echo "🔍 Missing required system dependencies: ${missing[*]}"

  # Check if apt-get is available (Debian/Ubuntu)
  if command -v apt-get &>/dev/null; then
    echo "📦 Debian/Ubuntu detected. Installing missing dependencies..."
    
    # Resolve package names
    local packages=()
    for cmd in "${missing[@]}"; do
      case "$cmd" in
        docker) packages+=("docker.io") ;;
        *) packages+=("$cmd") ;;
      esac
    done

    # Run apt-get update & install
    if [ "$EUID" -eq 0 ]; then
      apt-get update && apt-get install -y "${packages[@]}"
    elif command -v sudo &>/dev/null; then
      sudo apt-get update && sudo apt-get install -y "${packages[@]}"
    else
      echo "❌ Error: Root or sudo privileges required to install: ${packages[*]}"
      exit 1
    fi
  else
    echo "⚠️  Please manually install the following packages: ${missing[*]}"
    exit 1
  fi
}

ensure_dependencies

echo "🔧 Installing opencode-orchestrator CLI wrapper..."

# Determine installation directory (default to ~/.local/bin)
INSTALL_DIR="$HOME/.local/bin"
if [ ! -d "$INSTALL_DIR" ]; then
  mkdir -p "$INSTALL_DIR"
fi

WRAPPER_PATH="$INSTALL_DIR/opencode"

echo "📝 Creating wrapper script at $WRAPPER_PATH..."
cat << 'EOF' > "$WRAPPER_PATH"
#!/usr/bin/env bash
set -euo pipefail

# Check if the Docker image is built, if not, build it from the public repo
if ! docker inspect opencode-custom:latest &>/dev/null; then
  echo "🔧 Image 'opencode-custom:latest' not found. Compiling from GitHub repository..." >&2
  docker build -t opencode-custom:latest https://github.com/synlace/opencode-orchestrator.git >&2
fi

# Resolve the BWS token securely
LOCAL_BWS_TOKEN="${BWS_ACCESS_TOKEN:-}"
if [ -z "$LOCAL_BWS_TOKEN" ] && command -v secret-tool &> /dev/null; then
  LOCAL_BWS_TOKEN=$(secret-tool lookup service bws-token account synlace 2>/dev/null || echo "")
fi

# Determine TTY
TTY_FLAG=""
if [ -t 0 ] && [ -t 1 ]; then
  TTY_FLAG="-t"
fi

# Resolve Docker GID to grant container socket access
DOCKER_GID=""
if [ -S /var/run/docker.sock ]; then
  DOCKER_GID="--group-add $(stat -c '%g' /var/run/docker.sock)"
fi

# Setup SSH mount if it exists
SSH_MOUNT=""
if [ -d "$HOME/.ssh" ]; then
  SSH_MOUNT="-v $HOME/.ssh:/home/user/.ssh:ro"
fi

# Execute the container with persistent workspace directories and passed environment variables
exec docker run \
  -i $TTY_FLAG \
  --rm \
  --network host \
  $DOCKER_GID \
  -v "/var/run/docker.sock:/var/run/docker.sock" \
  $SSH_MOUNT \
  -v "$HOME/.config/opencode:/home/user/.config/opencode" \
  -v "$HOME/.local/share/opencode:/home/user/.local/share/opencode" \
  -v "$HOME/.local/state/opencode:/home/user/.local/state/opencode" \
  -v "$PWD:$PWD" \
  -w "$PWD" \
  -e HOME=/home/user \
  -e BWS_ACCESS_TOKEN="$LOCAL_BWS_TOKEN" \
  -e LINEAR_API_KEY="${LINEAR_API_KEY:-}" \
  -e LINEAR_ACCESS_TOKEN="${LINEAR_ACCESS_TOKEN:-}" \
  -e GITHUB_TOKEN="${GITHUB_TOKEN:-}" \
  -e OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}" \
  -e CONTEXT7_AUTHORIZATION="${CONTEXT7_AUTHORIZATION:-}" \
  -e GMAIL_CLIENT_ID="${GMAIL_CLIENT_ID:-}" \
  -e GMAIL_CLIENT_SECRET="${GMAIL_CLIENT_SECRET:-}" \
  -e GMAIL_REFRESH_TOKEN="${GMAIL_REFRESH_TOKEN:-}" \
  -e GOOGLE_REFRESH_TOKEN="${GOOGLE_REFRESH_TOKEN:-}" \
  -e GMAIL_ACCESS_TOKEN="${GMAIL_ACCESS_TOKEN:-}" \
  -e GOOGLE_ACCESS_TOKEN="${GOOGLE_ACCESS_TOKEN:-}" \
  -e GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-}" \
  -e OPENCODE_MODEL="${OPENCODE_MODEL:-}" \
  -e SSH_PRIVATE_KEY="${SSH_PRIVATE_KEY:-}" \
  opencode-custom:latest "$@"
EOF

chmod +x "$WRAPPER_PATH"

echo "✅ Successfully installed 'opencode' to $WRAPPER_PATH"
echo "👉 Ensure '$INSTALL_DIR' is added to your PATH (e.g. in .bashrc or .zshrc):"
echo "   export PATH=\"\$HOME/.local/bin:\$PATH\""
