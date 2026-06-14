# OpenCode Orchestrator

`opencode-orchestrator` is a self-contained, highly secure, and isolated environment for running OpenCode with Bitwarden Secrets Manager (BWS), local MCP servers (Gmail, Calendar, Drive, People), and a layered custom ECC (Evolutionary Code Conductor) harness.

---

## ⚡ Quick Start (One-Line Installation)

To download, compile, and register the `opencode` CLI wrapper globally on your host, run this single command:

```bash
curl -fsSL https://raw.githubusercontent.com/synlace/opencode-orchestrator/main/install.sh | bash
```

> **Note**: Ensure `~/.local/bin` is in your PATH. If not, add `export PATH="$HOME/.local/bin:$PATH"` to your `.bashrc` or `.zshrc`.

---

## ✨ Features

* **📦 Zero Host Pollution & Total SSH Isolation**: All tools (Git, GitHub CLI, BWS CLI, Node) run strictly containerized. No host `~/.ssh` directory is ever mounted, protecting your host credentials.
* **🔑 Self-Healing SSH Key Flow**: On boot, the container automatically configures a secure SSH connection:
  1. Loads existing keys if stored in BWS (under `SSH Private Key`) or host environment (`SSH_PRIVATE_KEY`).
  2. If none exist, it **generates a brand-new ED25519 key** inside the container and **automatically registers it with your GitHub account** (using your `GITHUB_TOKEN`).
* **🌐 Optional Bitwarden Secrets Manager (BWS)**: Run fully integrated with BWS or entirely locally/offline using standard shell environment variables.
* **🤖 Env-Driven Custom Models**: Change your default agent model (e.g. to Claude, GPT-4, or Gemini) dynamically via terminal environment variables without editing configurations.
* **🧩 Bundled Local MCP Servers**: Local MCP servers (Gmail, Calendar, Drive, People) are pre-packaged directly inside the container, eliminating the need to install Node/NPM dependencies on the host machine.
* **🚀 ECC Repository Initializer**: Streamlines repository bootstrapping through `opencode init <repo-name>`, which creates a matching project in Linear and automatically registers/publishes it to GitHub.

---

## ⚙️ Configuration & Environment Variables

The orchestrator dynamically reads from your local shell environment and forwards the following options through the Docker barrier:

| Variable | Description |
| :--- | :--- |
| `BWS_ACCESS_TOKEN` | *Optional.* Your Bitwarden Secrets Manager token to resolve all API keys on boot. |
| `OPENCODE_MODEL` | *Optional.* Override default models (defaults to `openrouter/google/gemini-3.5-flash`). |
| `OPENROUTER_API_KEY` | *Optional.* API key if using OpenRouter models (if not fetched from BWS). |
| `LINEAR_API_KEY` | *Optional.* Linear API key (if not fetched from BWS). |
| `GITHUB_TOKEN` | *Optional.* GitHub Personal Access Token (if not fetched from BWS). |
| `SSH_PRIVATE_KEY` | *Optional.* Plaintext ED25519 private key to initialize container SSH state. |

---

## 🚀 Usage

### Mode A: Fully Automated (BWS)
Export your BWS token. The container resolves all keys (Linear, GitHub, OpenRouter, Context7, Maps) and initializes SSH:
```bash
export BWS_ACCESS_TOKEN="0.446ad33b-..."
opencode
```

### Mode B: Pure Local / Offline (Direct Env)
Provide your keys directly in your terminal. BWS is skipped completely:
```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export LINEAR_API_KEY="lin-api-..."
export GITHUB_TOKEN="ghp_..."
opencode
```

### 1. Initialize a New Repository
Run this inside any empty folder to initialize a layered Custom ECC overlay, register a Linear project, and push the baseline to GitHub:
```bash
opencode init my-awesome-project --public
```

### 2. Launch the Web Daemon
To run the OpenCode agent in server/daemon mode:
```bash
opencode serve --port 9001
```

---

## 🛠 Manual Setup & Custom Builds

If you prefer to build the Docker image and run it manually without using the installation script:

1. Build the image:
```bash
docker build -t opencode-custom:latest .
```

2. Run the agent manually:
```bash
docker run -it --rm \
  --network host \
  -v "$HOME/.config/opencode:/home/user/.config/opencode" \
  -v "$HOME/.local/share/opencode:/home/user/.local/share/opencode" \
  -v "$HOME/.local/state/opencode:/home/user/.local/state/opencode" \
  -v "$PWD:$PWD" \
  -w "$PWD" \
  -e HOME=/home/user \
  -e BWS_ACCESS_TOKEN="your-bws-token-here" \
  opencode-custom:latest
```
