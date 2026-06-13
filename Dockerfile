FROM ghcr.io/anomalyco/opencode:latest

# Install lightweight runtime dependencies
RUN apk add --no-cache nodejs npm git bash openssh-client docker-cli jq curl unzip github-cli

# Install BWS CLI inside the container
RUN wget https://github.com/bitwarden/sdk-sm/releases/download/bws-v2.1.0/bws-x86_64-unknown-linux-musl-2.1.0.zip \
    && unzip bws-*.zip -d /usr/local/bin \
    && rm bws-*.zip

# Bundle local MCP servers
COPY mcp-servers/ /opt/mcp-servers/

# Copy entrypoint and configuration template
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY opencode.template.jsonc /etc/opencode/opencode.template.jsonc
COPY ecc-git-init /usr/local/bin/ecc-git-init
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/ecc-git-init

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
