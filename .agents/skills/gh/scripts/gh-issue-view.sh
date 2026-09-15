#!/usr/bin/env bash
set -eo pipefail

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

BODY=""
COMMENTS=""

# Fetch body if requested
if [ "$INCLUDE_BODY" = true ]; then
  BODY="$(gh issue view "${TARGET}" | cat)"
fi

# Fetch comments if requested
if [ "$INCLUDE_COMMENTS" = true ]; then
  COMMENTS="$(gh issue view "${TARGET}" --comments 2>/dev/null | cat || true)"
fi

# Calculate total payload size
TOTAL_BYTES=$(( ${#BODY} + ${#COMMENTS} ))
LIMIT=7000 # Safe ceiling comfortably below 8,192 byte terminal buffer

if [ "$TOTAL_BYTES" -gt "$LIMIT" ]; then
  OUT_FILE="$(mktemp "${TMPDIR:-/tmp}/gh-issue-${TARGET}-XXXXXX.md")"
  {
    if [ -n "$BODY" ]; then
      printf "%s\n" "$BODY"
    fi
    if [ -n "$COMMENTS" ]; then
      if [ -n "$BODY" ]; then
        printf "\n"
      fi
      printf "%s\n" "$COMMENTS"
    fi
  } > "$OUT_FILE"

  echo "$ gh issue view ${TARGET}"
  echo "Output (${TOTAL_BYTES} bytes) exceeds 8KB terminal limit; saved to: ${OUT_FILE} (view with view_file)"
else
  if [ "$INCLUDE_BODY" = true ]; then
    echo "$ gh issue view ${TARGET} | cat"
    printf "%s\n" "$BODY"
  fi

  if [[ -n "$COMMENTS" ]]; then
    if [ "$INCLUDE_BODY" = true ]; then
      echo ""
    fi
    echo "$ gh issue view ${TARGET} --comments | cat"
    printf "%s\n" "$COMMENTS"
  fi
fi
