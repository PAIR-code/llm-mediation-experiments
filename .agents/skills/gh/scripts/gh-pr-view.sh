#!/usr/bin/env bash
set -eo pipefail

# Colors for command provenance echoing
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

# 1. PR Metadata & Description
if [ "$INCLUDE_BODY" = true ]; then
  echo -e "${CYAN}$ gh pr view ${TARGET} | cat${NC}"
  if ! gh pr view "${TARGET}" | cat; then
    echo "" >&2
    echo "Tip: If #${TARGET} is an Issue rather than a PR, use gh-issue-view.sh instead." >&2
    exit 1
  fi
fi

# 2. CI Status & Checks
if [ "$INCLUDE_CHECKS" = true ]; then
  # Fetch checks output; gh pr checks may exit 1 if any check failed, so capture output safely
  CHECKS=$(gh pr checks "${TARGET}" 2>&1 | cat || true)
  if [[ -n "$CHECKS" && "$CHECKS" != *"no checks reported"* ]]; then
    if [ "$INCLUDE_BODY" = true ]; then
      echo ""
    fi
    echo -e "${CYAN}$ gh pr checks ${TARGET} | cat${NC}"
    echo "$CHECKS"
  fi
fi

# 3. PR-Level Discussion Comments
if [ "$INCLUDE_COMMENTS" = true ]; then
  COMMENTS=$(gh pr view "${TARGET}" --comments 2>/dev/null | cat || true)
  if [[ -n "$COMMENTS" ]]; then
    echo ""
    echo -e "${CYAN}$ gh pr view ${TARGET} --comments | cat${NC}"
    echo "$COMMENTS"
  fi
fi

# 4. Inline Code Review Comments
if [ "$INCLUDE_REVIEWS" = true ]; then
  REVIEWS=$(gh api repos/{owner}/{repo}/pulls/"${TARGET}"/comments --jq '.[] | "[\(.path):\(.line // "diff")] \(.user.login): \(.body)"' 2>/dev/null || true)
  if [[ -n "$REVIEWS" ]]; then
    echo ""
    echo -e "${CYAN}$ gh api repos/{owner}/{repo}/pulls/${TARGET}/comments (inline code reviews)${NC}"
    echo "$REVIEWS"
  fi
fi
