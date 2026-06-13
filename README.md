# OpenCode Orchestrator

`opencode-orchestrator` is a self-contained, containerized environment for running OpenCode with Bitwarden Secrets Manager (BWS), local MCP servers (Gmail, Calendar, Drive, People), and a layered custom ECC (Evolutionary Code Conductor) harness.

## Features

* **Self-Contained Secret Resolution**: Pass your container a single `BWS_ACCESS_TOKEN` environment variable on startup. The container fetches all required credentials (Linear, Gmail, Context7, Maps) securely from Bitwarden Secrets Manager and generates the OpenCode configuration automatically.
* **Bundled Local MCP Servers**: Local MCP servers (Gmail, Calendar, Drive, People) are pre-packaged directly inside the container, eliminating the need to install Node/NPM dependencies on the host machine.
* **ECC Repository Initializer**: Streamlines repository bootstrapping through `opencode init <repo-name>`, which creates a matching project in Linear and automatically registers/publishes it to GitHub.
* **Zero Host Pollution**: All tool runtimes (Git, GitHub CLI, BWS CLI, jq, Node) are isolated inside the container.

## Local Setup

Build the orchestrator image:

```bash
docker build -t opencode-custom:latest .
```

## Running the Orchestrator

Initialize a new project:
```bash
docker run --rm \
  -v "$PWD:$PWD" \
  -w "$PWD" \
  -e BWS_ACCESS_TOKEN="your-bws-token-here" \
  opencode-custom:latest init my-awesome-project --public
```

Launch the interactive agent inside your workspace:
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
  -e BWS_ACCESS_TOKEN="your-bws-token-here" \
  opencode-custom:latest
```
