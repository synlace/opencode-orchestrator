# OpenCode Orchestrator

`opencode-orchestrator` is a self-contained, containerized environment for running OpenCode with Bitwarden Secrets Manager (BWS), local MCP servers (Gmail, Calendar, Drive, People), and a layered custom ECC (Evolutionary Code Conductor) harness.

---

## ⚡ Quick Start (One-Line Installation)

To download, compile, and register the `opencode` CLI wrapper globally on your host, run this single command:

```bash
curl -fsSL https://raw.githubusercontent.com/synlace/opencode-orchestrator/main/install.sh | bash
```

> **Note**: Ensure `~/.local/bin` is in your PATH. If not, add `export PATH="$HOME/.local/bin:$PATH"` to your `.bashrc` or `.zshrc`.

---

## Features

* **Self-Contained Secret Resolution**: Pass your container a single `BWS_ACCESS_TOKEN` environment variable on startup. The container fetches all required credentials (Linear, Gmail, Context7, Maps) securely from Bitwarden Secrets Manager and generates the OpenCode configuration automatically.
* **Bundled Local MCP Servers**: Local MCP servers (Gmail, Calendar, Drive, People) are pre-packaged directly inside the container, eliminating the need to install Node/NPM dependencies on the host machine.
* **ECC Repository Initializer**: Streamlines repository bootstrapping through `opencode init <repo-name>`, which creates a matching project in Linear and automatically registers/publishes it to GitHub.
* **Zero Host Pollution**: All tool runtimes (Git, GitHub CLI, BWS CLI, jq, Node) are isolated inside the container.

---

## Usage

### 1. Initialize a New Repository
Run this inside your project root to initialize a layered Custom ECC overlay, register a Linear project, and push the baseline to GitHub:
```bash
opencode init my-awesome-project --public
```

### 2. Launch the Interactive Agent
Run `opencode` in any repository workspace directory to launch the interactive agent:
```bash
opencode
```

---

## Manual / Offline Setup

If you prefer to build the Docker image and run it manually without using the installation script:

1. Build the image:
```bash
docker build -t opencode-custom:latest .
```

2. Run the agent manually:
```bash
docker run -it --rm \
  --network host \
  -v "$HOME/.ssh:/home/user/.ssh:ro" \
  -v "$HOME/.gitconfig:/home/user/.gitconfig:ro" \
  -v "$HOME/.config/opencode:/home/user/.config/opencode" \
  -v "$HOME/.local/share/opencode:/home/user/.local/share/opencode" \
  -v "$HOME/.local/state/opencode:/home/user/.local/state/opencode" \
  -v "$PWD:$PWD" \
  -w "$PWD" \
  -e HOME=/home/user \
  -e BWS_ACCESS_TOKEN="your-bws-token-here" \
  opencode-custom:latest
```
