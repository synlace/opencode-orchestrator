# OpenCode Orchestrator

`opencode-orchestrator` is a self-contained Docker-based environment for running OpenCode with Bitwarden Secrets Manager (BWS), local MCP servers (Gmail, Calendar, Drive, People), and a layered custom ECC (Evolutionary Code Conductor) harness.

## Features

* **Self-Contained Secret Resolution**: Pass your container a single `BWS_ACCESS_TOKEN` environment variable on startup. The container fetches all required credentials (Linear, Gmail, Context7, Maps) securely from Bitwarden Secrets Manager and generates the OpenCode config automatically.
* **Bundled Local MCP Servers**: Local MCP servers (Gmail, Calendar, Drive, People) are pre-packaged directly in the container, eliminating host NPM dependencies.
* **ECC Repository Initializer**: Streamlines repository bootstrapping through `opencode init <repo-name>`, creating matching Linear projects and publishing them to GitHub automatically.
* **Portable Overlay Symlinks**: Resolves path-portability issues by avoiding hardcoded host-side usernames (`/home/user`) in Checked-in Git files.

## Local Setup & Nix Host Integration

To use this with Maxos, the host package wrapper acts as a simple coordinator that resolves your local keyring's BWS token and executes the Docker runtime.

```bash
docker build -t opencode-orchestrator:latest .
```

## Running the Operator

Initialize a new project:
```bash
opencode init my-awesome-project --public
```

Launch the agent:
```bash
opencode
```
