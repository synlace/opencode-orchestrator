#!/usr/bin/env bash
set -euo pipefail

# If the first argument is "init", execute the bundled ecc-git-init script
if [ "${1:-}" = "init" ]; then
  shift
  # Ensure BWS variables are exported for the initializer
  if [ -n "${BWS_ACCESS_TOKEN:-}" ]; then
    export BWS_SERVER_URL="https://vault.bitwarden.eu"
  fi
  exec /usr/local/bin/ecc-git-init "$@"
fi

CONTEXT7_AUTHORIZATION=""
GOOGLE_MAPS_API_KEY=""

# Fetch secrets securely from Bitwarden Secrets Manager inside the container if BWS_ACCESS_TOKEN is provided
if [ -n "${BWS_ACCESS_TOKEN:-}" ]; then
  echo "🔑 [Container] Securely retrieving keys from Bitwarden Secrets Manager..." >&2
  export BWS_SERVER_URL="https://vault.bitwarden.eu"
  
  # Fetch secrets in one command to minimize round-trip network lag
  SECRET_DATA=$(bws secret list 2>/dev/null || echo "")
  if [ -n "$SECRET_DATA" ]; then
    # Print all available BWS key names for diagnostic purposes
    ALL_KEYS=$(echo "$SECRET_DATA" | jq -r '.[] | .key' 2>/dev/null | paste -sd ", " - || echo "")
    echo "📝 [Container] Keys found in BWS project: $ALL_KEYS" >&2

    # Resolve Linear API Key and export as LINEAR_API_KEY & LINEAR_ACCESS_TOKEN
    RESOLVED_LINEAR_KEY=$(echo "$SECRET_DATA" | jq -r '.[] | select(.key == "Linear API Key") | .value' 2>/dev/null || echo "")
    if [ -n "$RESOLVED_LINEAR_KEY" ]; then
      export LINEAR_API_KEY="$RESOLVED_LINEAR_KEY"
      export LINEAR_ACCESS_TOKEN="$RESOLVED_LINEAR_KEY"
      echo "✓ [Container] Successfully resolved Linear API Key." >&2
    else
      echo "⚠️ [Container] Warning: 'Linear API Key' not found in BWS project." >&2
    fi

    # Resolve GitHub PAT and export as GITHUB_TOKEN for in-container gh CLI support
    RESOLVED_GH_PAT=$(echo "$SECRET_DATA" | jq -r '.[] | select(.key == "GitHub PAT") | .value' 2>/dev/null | xargs || echo "")
    if [ -n "$RESOLVED_GH_PAT" ]; then
      export GITHUB_TOKEN="$RESOLVED_GH_PAT"
      echo "✓ [Container] Successfully resolved GitHub PAT." >&2
    fi

    # Resolve OpenRouter API Key and export as OPENROUTER_API_KEY
    RESOLVED_OR_KEY=$(echo "$SECRET_DATA" | jq -r '.[] | select(.key == "OpenRouter API Key") | .value' 2>/dev/null | xargs || echo "")
    if [ -n "$RESOLVED_OR_KEY" ]; then
      export OPENROUTER_API_KEY="$RESOLVED_OR_KEY"
      echo "✓ [Container] Successfully resolved OpenRouter API Key." >&2
    fi

    # Resolve Context7 API Key and format as Bearer token
    RESOLVED_C7_KEY=$(echo "$SECRET_DATA" | jq -r '.[] | select(.key == "Context7 API Key") | .value' 2>/dev/null || echo "")
    if [ -n "$RESOLVED_C7_KEY" ]; then
      CONTEXT7_AUTHORIZATION="Bearer $RESOLVED_C7_KEY"
      export CONTEXT7_AUTHORIZATION
      echo "✓ [Container] Successfully resolved Context7 API Key." >&2
    else
      echo "⚠️ [Container] Warning: 'Context7 API Key' not found in BWS project." >&2
    fi

    # Resolve Gmail Client ID and Secret from BWS
    export GMAIL_CLIENT_ID=$(echo "$SECRET_DATA" | jq -r '.[] | select(.key == "Gmail Client ID") | .value' 2>/dev/null | xargs || echo "")
    export GMAIL_CLIENT_SECRET=$(echo "$SECRET_DATA" | jq -r '.[] | select(.key == "Gmail Client Secret") | .value' 2>/dev/null | xargs || echo "")
    export GMAIL_REFRESH_TOKEN=$(echo "$SECRET_DATA" | jq -r '.[] | select(.key == "Gmail Refresh Token") | .value' 2>/dev/null | xargs || echo "")
    export GOOGLE_REFRESH_TOKEN=$(echo "$SECRET_DATA" | jq -r '.[] | select(.key == "Google Refresh Token") | .value' 2>/dev/null | xargs || echo "")
    export GOOGLE_MAPS_API_KEY=$(echo "$SECRET_DATA" | jq -r '.[] | select(.key == "Google Maps API Key") | .value' 2>/dev/null | xargs || echo "")
    GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-}"

    # Refresh OAuth token inside container
    REF_TOKEN="${GMAIL_REFRESH_TOKEN:-$GOOGLE_REFRESH_TOKEN}"
    if [ -n "$REF_TOKEN" ] && [ -n "$GMAIL_CLIENT_ID" ] && [ -n "$GMAIL_CLIENT_SECRET" ]; then
      echo "🔑 [Container] Exchanging Google/Gmail Refresh Token for a fresh Access Token..." >&2
      TOKEN_RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
        -d client_id="$GMAIL_CLIENT_ID" \
        -d client_secret="$GMAIL_CLIENT_SECRET" \
        -d refresh_token="$REF_TOKEN" \
        -d grant_type=refresh_token 2>/dev/null || echo "")
      
      EXTRACTED_ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token' 2>/dev/null || echo "")
      if [ -n "$EXTRACTED_ACCESS_TOKEN" ] && [ "$EXTRACTED_ACCESS_TOKEN" != "null" ]; then
        export GMAIL_ACCESS_TOKEN="$EXTRACTED_ACCESS_TOKEN"
        export GOOGLE_ACCESS_TOKEN="$EXTRACTED_ACCESS_TOKEN"
        echo "✓ [Container] Successfully generated fresh Gmail/Google Access Token." >&2
      else
        echo "⚠️ [Container] Warning: Failed to exchange Google Refresh Token." >&2
      fi
    fi
  else
    echo "❌ [Container] Error: Failed to retrieve secrets from BWS." >&2
  fi
fi

# 2. Dynamically render the active user-level configuration from the template inside the container
TEMPLATE_PATH="/etc/opencode/opencode.template.jsonc"
CONFIG_PATH="/home/user/.config/opencode/opencode.jsonc"

if [ -f "$TEMPLATE_PATH" ]; then
  mkdir -p "$(dirname "$CONFIG_PATH")"
  
  # Resolve the default agent model (fallback to Gemini 3.5 Flash on OpenRouter)
  ACTIVE_MODEL="${OPENCODE_MODEL:-openrouter/google/gemini-3.5-flash}"
  echo "🤖 [Container] Active Agent Model: $ACTIVE_MODEL" >&2

  sed \
    -e "s|@CONTEXT7_AUTHORIZATION@|${CONTEXT7_AUTHORIZATION:-}|g" \
    -e "s|@GOOGLE_MAPS_API_KEY@|${GOOGLE_MAPS_API_KEY:-}|g" \
    -e "s|@OPENCODE_AGENT_MODEL@|${ACTIVE_MODEL}|g" \
    "$TEMPLATE_PATH" > "$CONFIG_PATH"
  chmod 600 "$CONFIG_PATH"
  echo "✓ [Container] Generated opencode.jsonc config file." >&2
fi

# Clean up BWS session token from env before executing opencode
unset BWS_ACCESS_TOKEN
unset BWS_SERVER_URL

# Exec standard opencode
exec opencode "$@"
