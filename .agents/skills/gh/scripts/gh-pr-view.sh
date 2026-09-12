#!/usr/bin/env bash
set -eo pipefail

usage() {
  echo "Usage: $(basename "$0") <pr-number> [options]"
  echo ""
  echo "View a GitHub Pull Request cleanly with metadata, CI checks, discussion comments,"
  echo "and inline code review comments without PTY/Glamour truncation."
  echo ""
  echo "Arguments:"
  echo "  <number>           GitHub Pull Request number (e.g. 1246)"
  echo ""
  echo "Options:"
  echo "  --checks-only      Only display CI status and checks"
  echo "  --reviews-only     Only display inline code review comments"
  echo "  --comments-only    Only display general discussion comments"
  echo "  --no-checks        Skip CI status and checks"
  echo "  --no-reviews       Skip inline code review comments"
  echo "  --no-comments      Skip general discussion comments"
  echo "  -h, --help         Show this help message"
  exit 1
}

TARGET=""
INCLUDE_BODY=true
INCLUDE_CHECKS=true
INCLUDE_COMMENTS=true
INCLUDE_REVIEWS=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --checks-only)
      INCLUDE_BODY=false
      INCLUDE_CHECKS=true
      INCLUDE_COMMENTS=false
      INCLUDE_REVIEWS=false
      shift
      ;;
    --reviews-only)
      INCLUDE_BODY=false
      INCLUDE_CHECKS=false
      INCLUDE_COMMENTS=false
      INCLUDE_REVIEWS=true
      shift
      ;;
    --comments-only)
      INCLUDE_BODY=false
      INCLUDE_CHECKS=false
      INCLUDE_COMMENTS=true
      INCLUDE_REVIEWS=false
      shift
      ;;
    --no-checks)
      INCLUDE_CHECKS=false
      shift
      ;;
    --no-reviews)
      INCLUDE_REVIEWS=false
      shift
      ;;
    --no-comments)
      INCLUDE_COMMENTS=false
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
  echo "Error: Missing Pull Request number." >&2
  usage
fi

if ! [[ "$TARGET" =~ ^[0-9]+$ ]]; then
  echo "Error: Target '$TARGET' must be a numeric Pull Request number." >&2
  exit 1
fi

# Disable interactive prompts
export GH_PROMPT_DISABLED=1

BODY=""
CHECKS=""
COMMENTS=""
REVIEWS=""

# 1. PR Metadata & Description
if [ "$INCLUDE_BODY" = true ]; then
  if ! BODY="$(gh pr view "${TARGET}" 2>&1 | cat)"; then
    echo "$BODY" >&2
    echo "Tip: If #${TARGET} is an Issue rather than a PR, use gh-issue-view.sh instead." >&2
    exit 1
  fi
fi

# 2. CI Status & Checks
if [ "$INCLUDE_CHECKS" = true ]; then
  C_OUT="$(gh pr checks "${TARGET}" 2>&1 | cat || true)"
  if [[ -n "$C_OUT" && "$C_OUT" != *"no checks reported"* ]]; then
    CHECKS="$C_OUT"
  fi
fi

# 3. PR-Level Discussion Comments
if [ "$INCLUDE_COMMENTS" = true ]; then
  COMMENTS="$(gh pr view "${TARGET}" --comments 2>/dev/null | cat || true)"
fi

# 4. Inline Code Review Comments
if [ "$INCLUDE_REVIEWS" = true ]; then
  REVIEWS="$(gh api repos/{owner}/{repo}/pulls/"${TARGET}"/comments --jq '.[] | "[\(.path):\(.line // "diff")] \(.user.login): \(.body)"' 2>/dev/null || true)"
fi

# Calculate total payload size
TOTAL_BYTES=$(( ${#BODY} + ${#CHECKS} + ${#COMMENTS} + ${#REVIEWS} ))
LIMIT=7000 # Safe ceiling comfortably below 8,192 byte terminal buffer

if [ "$TOTAL_BYTES" -gt "$LIMIT" ]; then
  OUT_FILE="$(mktemp "${TMPDIR:-/tmp}/gh-pr-${TARGET}-XXXXXX.md")"
  {
    if [ -n "$BODY" ]; then
      printf "%s\n" "$BODY"
    fi
    if [ -n "$CHECKS" ]; then
      printf "\n---\n## CI Checks\n\n%s\n" "$CHECKS"
    fi
    if [ -n "$COMMENTS" ]; then
      printf "\n---\n## Discussion Comments\n\n%s\n" "$COMMENTS"
    fi
    if [ -n "$REVIEWS" ]; then
      printf "\n---\n## Inline Code Reviews\n\n%s\n" "$REVIEWS"
    fi
  } > "$OUT_FILE"

  echo "$ gh pr view ${TARGET}"
  echo "Output (${TOTAL_BYTES} bytes) exceeds 8KB terminal limit; saved to: ${OUT_FILE} (view with view_file)"
else
  if [ -n "$BODY" ]; then
    echo "$ gh pr view ${TARGET} | cat"
    printf "%s\n" "$BODY"
  fi

  if [ -n "$CHECKS" ]; then
    if [ -n "$BODY" ]; then
      echo ""
    fi
    echo "$ gh pr checks ${TARGET} | cat"
    printf "%s\n" "$CHECKS"
  fi

  if [ -n "$COMMENTS" ]; then
    if [ -n "$BODY" ] || [ -n "$CHECKS" ]; then
      echo ""
    fi
    echo "$ gh pr view ${TARGET} --comments | cat"
    printf "%s\n" "$COMMENTS"
  fi

  if [ -n "$REVIEWS" ]; then
    if [ -n "$BODY" ] || [ -n "$CHECKS" ] || [ -n "$COMMENTS" ]; then
      echo ""
    fi
    echo "$ gh api repos/{owner}/{repo}/pulls/${TARGET}/comments (inline code reviews)"
    printf "%s\n" "$REVIEWS"
  fi
fi
