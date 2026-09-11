#!/usr/bin/env bash
set -eo pipefail

# Colors for command provenance echoing
CYAN='\033[0;36m'
NC='\033[0m' # No Color

usage() {
  echo "Usage: $(basename "$0") <issue-or-pr-number> [--no-comments | --comments-only]"
  echo ""
  echo "View a GitHub Issue or Pull Request cleanly without PTY/Glamour truncation."
  echo ""
  echo "Arguments:"
  echo "  <number>           GitHub Issue or Pull Request number (e.g. 1245)"
  echo ""
  echo "Options:"
  echo "  --no-comments      Only display the issue/PR header and description"
  echo "  --comments-only    Only display the discussion comments thread"
  echo "  -h, --help         Show this help message"
  exit 1
}

TARGET=""
INCLUDE_BODY=true
INCLUDE_COMMENTS=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-comments)
      INCLUDE_COMMENTS=false
      shift
      ;;
    --comments-only)
      INCLUDE_BODY=false
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      if [[ -z "$TARGET" ]]; then
        TARGET="$1"
        shift
      else
        echo "Error: Unexpected argument '$1'" >&2
        usage
      fi
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "Error: Missing issue or PR number." >&2
  usage
fi

if ! [[ "$TARGET" =~ ^[0-9]+$ ]]; then
  echo "Error: Target '$TARGET' must be a numeric Issue or PR number." >&2
  exit 1
fi

# Disable interactive prompts
export GH_PROMPT_DISABLED=1

# Stream body if requested
if [ "$INCLUDE_BODY" = true ]; then
  echo -e "${CYAN}$ gh issue view ${TARGET} | cat${NC}"
  gh issue view "${TARGET}" | cat
fi

# Stream comments if requested
if [ "$INCLUDE_COMMENTS" = true ]; then
  COMMENTS=$(gh issue view "${TARGET}" --comments | cat)
  if [[ -n "$COMMENTS" ]]; then
    if [ "$INCLUDE_BODY" = true ]; then
      echo ""
    fi
    echo -e "${CYAN}$ gh issue view ${TARGET} --comments | cat${NC}"
    echo "$COMMENTS"
  fi
fi
