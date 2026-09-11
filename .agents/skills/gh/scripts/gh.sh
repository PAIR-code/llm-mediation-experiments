#!/usr/bin/env bash
set -eo pipefail

# Colors for command provenance echoing
CYAN='\033[0;36m'
NC='\033[0m' # No Color

if [[ $# -eq 0 ]]; then
  echo "Usage: $(basename "$0") <gh-command> [args...]"
  echo "Example: $(basename "$0") pr list"
  exit 1
fi

# Disable interactive prompts
export GH_PROMPT_DISABLED=1

echo -e "${CYAN}$ gh $* | cat${NC}"

# If stdout is a terminal, pipe through cat to prevent Glamour PTY inflation.
# If already piped or redirected, pipe through cat anyway to ensure clean streaming.
gh "$@" | cat
