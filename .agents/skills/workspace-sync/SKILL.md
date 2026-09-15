---
name: workspace-sync
description: >
  Deterministic synchronization of trunk, PR evaluation worktrees, and drift
  reporting in Deliberate Lab's bare repository workspace.
---

# Workspace Sync

Synchronize all branches and worktrees in Deliberate Lab's bare repository layout against `upstream` and `origin`.

This skill replaces manual, multi-step git operations with a single deterministic automation script that fast-forwards trunk, mirrors PR evaluation worktrees, identifies merged/closed PRs for cleanup, and reports feature branch drift.

## When to use

Invoke this skill when asked to:
- "Sync workspace"
- "Update all PR worktrees"
- "Pull latest changes"
- "Catch up with upstream"
- "Check branch drift"
- "Sync my fork"

## Procedure

### 1. Run the Synchronization Script

From any worktree directory or the parent repository container:

```sh
./.agents/skills/workspace-sync/scripts/workspace-sync.sh
```

To preview changes without altering any git refs or worktree checkouts:

```sh
./.agents/skills/workspace-sync/scripts/workspace-sync.sh --dry-run
```

To only sync trunk and feature branch status without touching PR worktrees:

```sh
./.agents/skills/workspace-sync/scripts/workspace-sync.sh --skip-pr-mirror
```

The script visibly echoes the underlying git commands by default (prefixed with `[dry-run]` during dry-run mode) and formats all worktree targets with actionable relative paths. If the sync report exceeds 7 KB, it automatically saves to a temporary file via `mktemp` and provides the path for lossless inspection via `view_file` ([ADR 0003](../../decisions/0003-agent-tooling-output-standards.md)).

### 2. Understanding the Execution Phases

The script executes four deterministic stages:

1. **Remote Pruning**: Runs `git fetch --all --prune` to refresh all remotes and clean up deleted remote-tracking refs.
2. **Trunk Synchronization (`main`)**:
   - Ensures `main/` is clean before touching it.
   - Fast-forwards `main` to `upstream/main` (`git merge --ff-only upstream/main`).
   - Pushes `main` to `origin/main` to keep your personal fork in sync.
3. **PR Worktree Mirroring (`pr-<number>`)**:
   - Finds all sibling worktrees matching `pr-[0-9]*`.
   - **Safety First**: Any worktree with uncommitted changes (`git status --porcelain`) is skipped to prevent data loss.
   - **Lifecycle Awareness & Automated Cleanup**: Queries GitHub CLI (`gh pr view`) to see if the PR is `MERGED` or `CLOSED`. If so and the worktree is clean, automatically removes the worktree (`git worktree remove`) and deletes the local branch (`git branch -D`), keeping the workspace free of zombie checkouts.
   - **Exact Mirroring**: For open PRs, fetches `upstream pull/<number>/head` and resets the local branch to `FETCH_HEAD`.
   - **Dependency Notice**: If `package.json` or `package-lock.json` changed during the update, reminds you to run `npm ci` in that worktree.
4. **Feature Branch Drift Awareness**:
   - Inspects active development branches (e.g. `<issue>-<slug>`).
   - Reports commit counts ahead and behind `main`.
   - If a feature branch is behind, suggests running `git rebase main` inside that worktree when the author is ready.

## Safety Rules

- **Never rebase or merge PR evaluation worktrees**: External PRs must remain exact mirrors of their upstream head.
- **Never clobber dirty worktrees**: Any worktree with unstaged or uncommitted changes is protected and skipped.
- **Do not auto-rebase active feature branches**: Feature branches may be in the middle of active development or testing. The script only *reports* divergence; rebasing is left to the developer or agent at an intentional time.

