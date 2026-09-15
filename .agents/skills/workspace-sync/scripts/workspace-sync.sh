#!/usr/bin/env bash
#
# workspace-sync.sh — Deliberate Lab Workspace Synchronizer
#
# Performs deterministic workspace-level synchronization:
# 1. Prunes and fetches all remotes (git fetch --all --prune)
# 2. Synchronizes trunk (main) with upstream/main and pushes to origin/main
# 3. Mirrors all clean pr-<number> worktrees to upstream pull/<number>/head
# 4. Detects merged/closed PR worktrees and flags them for safe cleanup
# 5. Reports drift (ahead/behind counts) for active local feature branches
#

set -uo pipefail

DRY_RUN=false
SKIP_PR_MIRROR=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Synchronizes the Deliberate Lab bare repository workspace against upstream and origin.

Options:
  -n, --dry-run          Simulate actions without modifying git refs or worktrees
      --skip-pr-mirror   Skip syncing pr-<number> evaluation worktrees
  -h, --help             Show this help message and exit
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-pr-mirror)
      SKIP_PR_MIRROR=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

# -----------------------------------------------------------------------------
# Helper: Run command with bounded timeout (ADR 0003 Standard 6)
# -----------------------------------------------------------------------------
run_with_timeout() {
  local duration="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$duration" "$@"
  else
    "$@"
  fi
}

# -----------------------------------------------------------------------------
# 0. Locate Workspace Root (Bare Repository Container)
# -----------------------------------------------------------------------------
find_workspace_root() {
  # If currently in the container directory that holds .bare
  if [ -d "$PWD/.bare" ] || [ -f "$PWD/.bare/config" ]; then
    echo "$PWD"
    return 0
  fi
  # If inside a worktree
  local toplevel
  toplevel="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -n "$toplevel" ]; then
    local parent
    parent="$(dirname "$toplevel")"
    if [ -d "$parent/.bare" ] || [ -f "$parent/.bare/config" ]; then
      echo "$parent"
      return 0
    fi
  fi
  return 1
}

WORKSPACE_ROOT="$(find_workspace_root || true)"
if [ -z "$WORKSPACE_ROOT" ]; then
  echo "[ERROR] Could not determine Deliberate Lab workspace root (.bare not found)." >&2
  exit 1
fi

rel_path_of() {
  local p="$1"
  local r
  r="$(realpath --relative-to="$PWD" "$p" 2>/dev/null || echo "$p")"
  if [[ "$r" != /* && "$r" != .* ]]; then
    r="./$r"
  fi
  echo "$r"
}

perform_sync() {
  echo "======================================================"
  echo "         Deliberate Lab — Workspace Sync             "
  if [ "$DRY_RUN" = true ]; then
    echo "         [DRY RUN MODE — No changes will be made]"
  fi
  echo "======================================================"
  echo ""

  # -----------------------------------------------------------------------------
  # 1. Prune and Fetch Remotes
  # -----------------------------------------------------------------------------
  echo "[1/4] Remote Refreshes"
if [ "$DRY_RUN" = true ]; then
  echo "      $ [dry-run] git fetch --all --prune"
  echo "      [DRY RUN] Would fetch all remotes and prune deleted refs"
else
  echo "      $ git fetch --all --prune"
  git fetch --all --prune --quiet
  echo "      [OK] Remotes refreshed and pruned"
fi
echo ""

# -----------------------------------------------------------------------------
# 2. Trunk Synchronization (main -> origin/main)
# -----------------------------------------------------------------------------
echo "[2/4] Trunk Synchronization (main)"
MAIN_DIR="$WORKSPACE_ROOT/main"
MAIN_REL="$(rel_path_of "$MAIN_DIR")"

if [ ! -d "$MAIN_DIR" ]; then
  echo "      [WARN] Sibling worktree 'main' not found at $MAIN_REL. Skipping trunk sync."
else
  MAIN_DIRTY="$(git -C "$MAIN_DIR" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$MAIN_DIRTY" -gt 0 ]; then
    echo "      [WARN] '${MAIN_REL}' worktree has uncommitted modifications ($MAIN_DIRTY files). Skipping fast-forward to protect uncommitted work."
  else
    CURRENT_MAIN_SHA="$(git -C "$MAIN_DIR" rev-parse HEAD 2>/dev/null || true)"
    UPSTREAM_MAIN_SHA="$(git -C "$MAIN_DIR" rev-parse refs/remotes/upstream/main 2>/dev/null || true)"

    if [ -z "$UPSTREAM_MAIN_SHA" ]; then
      echo "      [WARN] Remote ref upstream/main not found."
    elif [ "$CURRENT_MAIN_SHA" = "$UPSTREAM_MAIN_SHA" ]; then
      echo "      [OK] Local '${MAIN_REL}' is already up to date with upstream/main (${CURRENT_MAIN_SHA:0:8})"
    else
      if [ "$DRY_RUN" = true ]; then
        echo "      $ [dry-run] git -C ${MAIN_REL} merge --ff-only upstream/main"
        echo "      $ [dry-run] git -C ${MAIN_REL} push origin main"
        echo "      [DRY RUN] Would fast-forward '${MAIN_REL}' (${CURRENT_MAIN_SHA:0:8} -> ${UPSTREAM_MAIN_SHA:0:8}) and push to origin/main"
      else
        echo "      $ git -C ${MAIN_REL} merge --ff-only upstream/main"
        git -C "$MAIN_DIR" merge --ff-only upstream/main --quiet
        echo "      $ git -C ${MAIN_REL} push origin main"
        git -C "$MAIN_DIR" push origin main --quiet
        echo "      [UPDATED] '${MAIN_REL}' fast-forwarded to upstream/main (${UPSTREAM_MAIN_SHA:0:8}) and pushed to origin/main"
      fi
    fi
  fi
fi
echo ""

# -----------------------------------------------------------------------------
# 3. PR Worktree Mirroring (pr-<number>) & Automatic Cleanup
# -----------------------------------------------------------------------------
echo "[3/4] PR Evaluation Worktrees (pr-<number>)"

if [ "$SKIP_PR_MIRROR" = true ]; then
  echo "      Skipping PR evaluation worktrees (--skip-pr-mirror specified)."
else
  # Find all sibling directories matching pr-[0-9]*
  PR_DIRS=()
  for dir in "$WORKSPACE_ROOT"/pr-[0-9]*; do
    [ -d "$dir" ] && PR_DIRS+=("$dir")
  done

  if [ "${#PR_DIRS[@]}" -eq 0 ]; then
    echo "      No pr-<number> worktrees found."
  else
    for pr_dir in "${PR_DIRS[@]}"; do
      pr_name="$(basename "$pr_dir")"
      pr_num="${pr_name#pr-}"
      pr_rel="$(rel_path_of "$pr_dir")"
      echo "      ==> ${pr_rel} (PR #${pr_num})"

      # Check for dirty working tree
      dirty_count="$(git -C "$pr_dir" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
      if [ "$dirty_count" -gt 0 ]; then
        echo "          [SKIP] Worktree has $dirty_count uncommitted change(s). Skipped to avoid data loss."
        continue
      fi

      # Check PR state on GitHub via gh CLI if available (bounded by timeout per ADR 0003 Standard 6)
      PR_STATE="OPEN"
      PR_TITLE=""
      if command -v gh >/dev/null 2>&1; then
        GH_TIMEOUT="${GH_TIMEOUT:-5s}"
        gh_info=""
        gh_exit=0
        gh_info="$(run_with_timeout "$GH_TIMEOUT" gh pr view "$pr_num" --repo PAIR-code/deliberate-lab --json state,title -q '.state + "\t" + .title' 2>/dev/null)" || gh_exit=$?
        if [ "$gh_exit" -eq 0 ] && [ -n "$gh_info" ]; then
          PR_STATE="$(echo "$gh_info" | awk -F'\t' '{print $1}')"
          PR_TITLE="$(echo "$gh_info" | awk -F'\t' '{print $2}')"
        elif [ "$gh_exit" -eq 124 ]; then
          echo "          [WARN] Timed out querying PR #${pr_num} state from GitHub CLI after ${GH_TIMEOUT}."
          echo "                 The system credential store (e.g. GNOME Keyring) may be locked."
          echo "                 Preserving worktree and treating as OPEN."
        fi
      fi

      if [ "$PR_STATE" = "MERGED" ] || [ "$PR_STATE" = "CLOSED" ]; then
        if [ "$pr_dir" = "$PWD" ]; then
          echo "          [SKIP] Cannot remove active current worktree (${PR_STATE} PR #${pr_num}). Switch to another directory first."
          continue
        fi

        if [ "$DRY_RUN" = true ]; then
          echo "          $ [dry-run] git worktree remove \"${pr_rel}\" && git branch -D \"${pr_name}\""
          echo "          [DRY RUN] Would remove worktree and branch for ${PR_STATE} PR #${pr_num} (\"${PR_TITLE}\")"
        else
          echo "          $ git worktree remove \"${pr_rel}\""
          git worktree remove "$pr_dir"
          echo "          $ git branch -D \"${pr_name}\""
          git branch -D "$pr_name" --quiet
          echo "          [REMOVED] PR #${pr_num} is ${PR_STATE} on GitHub. Cleaned up worktree and branch."
        fi
        continue
      fi

      # PR is OPEN: Mirror upstream pull/<number>/head
      current_sha="$(git -C "$pr_dir" rev-parse HEAD 2>/dev/null || true)"
      if [ "$DRY_RUN" = true ]; then
        echo "          $ [dry-run] git -C ${pr_rel} fetch upstream pull/${pr_num}/head && git -C ${pr_rel} reset --hard FETCH_HEAD"
        fetched_sha="$(git ls-remote upstream "refs/pull/${pr_num}/head" 2>/dev/null | awk '{print $1}')"
        if [ -n "$fetched_sha" ] && [ "$current_sha" = "$fetched_sha" ]; then
          echo "          [OK] Up to date (${current_sha:0:8})"
        else
          echo "          [DRY RUN] Would fetch & reset to upstream head (${current_sha:0:8} -> ${fetched_sha:0:8})"
        fi
      else
        echo "          $ git -C ${pr_rel} fetch upstream pull/${pr_num}/head"
        git -C "$pr_dir" fetch upstream "pull/${pr_num}/head" --quiet
        fetched_sha="$(git -C "$pr_dir" rev-parse FETCH_HEAD 2>/dev/null || true)"

        if [ "$current_sha" = "$fetched_sha" ]; then
          echo "          [OK] Up to date (${current_sha:0:8})"
        else
          echo "          $ git -C ${pr_rel} reset --hard FETCH_HEAD"
          git -C "$pr_dir" reset --hard FETCH_HEAD --quiet
          echo "          [UPDATED] Mirrored upstream head: ${current_sha:0:8} -> ${fetched_sha:0:8}"

          # Check if dependencies changed
          if git -C "$pr_dir" diff --name-only "$current_sha" "$fetched_sha" 2>/dev/null | grep -qE '^package(-lock)?\.json$'; then
            echo "          [NOTICE] Dependencies changed in ${pr_rel}. Run 'npm ci' in ${pr_rel} before running or testing."
          fi
        fi
      fi
    done
  fi
fi
echo ""

# -----------------------------------------------------------------------------
# 4. Feature Branch Drift Awareness
# -----------------------------------------------------------------------------
echo "[4/4] Feature Branch Drift Awareness"

# Discover non-main, non-pr sibling worktrees
FEATURE_DIRS=()
for dir in "$WORKSPACE_ROOT"/*; do
  [ -d "$dir" ] || continue
  bname="$(basename "$dir")"
  # Ignore bare, main, pr-*, and dotfiles
  if [[ "$bname" != ".bare" && "$bname" != "main" && ! "$bname" =~ ^pr-[0-9]+$ && ! "$bname" =~ ^\. ]]; then
    # Must be a git worktree
    if git -C "$dir" rev-parse --git-dir >/dev/null 2>&1; then
      FEATURE_DIRS+=("$dir")
    fi
  fi
done

if [ "${#FEATURE_DIRS[@]}" -eq 0 ]; then
  echo "      No local feature branch worktrees detected."
else
  for feat_dir in "${FEATURE_DIRS[@]}"; do
    feat_name="$(basename "$feat_dir")"
    feat_rel="$(rel_path_of "$feat_dir")"
    branch_name="$(git -C "$feat_dir" branch --show-current 2>/dev/null || true)"
    [ -z "$branch_name" ] && branch_name="(detached HEAD)"

    counts="$(git rev-list --left-right --count "refs/heads/${branch_name}...refs/heads/main" 2>/dev/null || echo "0 0")"
    ahead="$(echo "$counts" | awk '{print $1}')"
    behind="$(echo "$counts" | awk '{print $2}')"

    if [ "$behind" -gt 0 ]; then
      echo "      [BEHIND] ${feat_rel} (${branch_name}): ${behind} commit(s) behind main (${ahead} ahead)"
      echo "               👉 Run: git -C \"${feat_rel}\" rebase main when ready to incorporate upstream changes."
    else
      echo "      [OK] ${feat_rel} (${branch_name}): In sync with main (${ahead} ahead)"
    fi
  done
fi

  echo ""
  echo "======================================================"
  echo "Workspace sync complete."
  echo "======================================================"
}

SYNC_OUTPUT="$(perform_sync)"
TOTAL_BYTES="${#SYNC_OUTPUT}"
LIMIT="${SYNC_BUFFER_LIMIT:-7000}" # Safe ceiling comfortably below 8,192 byte terminal buffer (ADR 0003 Standard 5)

if [ "$TOTAL_BYTES" -gt "$LIMIT" ]; then
  OUT_FILE="$(mktemp "${TMPDIR:-/tmp}/workspace-sync-XXXXXX.txt")"
  printf "%s\n" "$SYNC_OUTPUT" > "$OUT_FILE"
  echo "Workspace sync report (${TOTAL_BYTES} bytes) exceeds 8KB terminal limit; saved to: ${OUT_FILE} (view with view_file)"
else
  printf "%s\n" "$SYNC_OUTPUT"
fi

