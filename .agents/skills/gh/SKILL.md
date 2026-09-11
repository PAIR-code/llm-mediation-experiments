---
name: gh
description: >
  Run GitHub CLI commands and inspect GitHub Issues and Pull Requests cleanly
  without PTY Glamour terminal truncation or comment-stripping traps.
---

# GitHub CLI (`gh`)

This skill equips AI coding agents and human developers with clean, reliable execution patterns for GitHub CLI (`gh`) in Deliberate Lab. It solves terminal buffer truncation, bypasses markdown formatting bloat, and provides a unified script for viewing complete issue and PR discussions.

## When to use

Invoke this skill when asked to:
- "Take a look at issue <id>"
- "What is issue <id> about?"
- "Inspect issue <id> and its comments"
- "Look at PR <id>"
- "What is PR <id> about?"
- "Read issue comments for <id>"
- "Run GitHub CLI command"
- "Check PR checks or status"

## Background: The Terminal Truncation Trap

When running `gh` inside persistent agent terminal sessions, two subtle traps routinely corrupt output:

1. **PTY / Glamour Byte Inflation**:
   When `gh` outputs to a pseudo-terminal (PTY), it invokes **Glamour** (a terminal markdown renderer) to format headings, borders, and ANSI colors. This inflates the byte size by **12× to 16×** (e.g. 6 KB of raw markdown expands to 70–100+ KB). When output exceeds the agent harness buffer ceiling (~45 KB), the harness truncates lines from the top (`<truncated N lines>`), silently discarding the issue title, problem statement, and earliest comments.
2. **The Non-TTY Mutual-Exclusion Trap**:
   When piping to `cat` to bypass Glamour (`gh issue view <id> | cat`), `gh` treats `view` and `view --comments` as **mutually exclusive**:
   - `gh issue view <id> | cat` prints *only* the issue header and body.
   - `gh issue view <id> --comments | cat` prints *only* the comments (omitting the body).
   Neither command alone gives an agent complete context in a single call.

The helper scripts in this skill resolve both issues cleanly.

## Procedures

### 1. View an Issue or Pull Request (`gh-issue-view.sh`)

To inspect a GitHub Issue or Pull Request with its complete description and all comments:

```sh
./.agents/skills/gh/scripts/gh-issue-view.sh <number>
```

*(From a sibling worktree directory, call `../.agents/skills/gh/scripts/gh-issue-view.sh <number>` or from repository root).*

**Features**:
- **Unified for Issues & PRs**: In GitHub CLI, `gh issue view <number>` works interchangeably on both Issues and Pull Requests.
- **Command Provenance**: Visibly echoes the underlying commands in cyan (`$ gh issue view ... | cat`) before execution.
- **Complete Context**: Streams the issue/PR description first, followed by the complete comment thread.
- **Compact Payload**: Bypasses Glamour so that even extensive issues fit comfortably in 5–10 KB with zero truncation.

**Optional Flags**:
- `--no-comments`: Output only the issue/PR header and description.
  ```sh
  ./.agents/skills/gh/scripts/gh-issue-view.sh <number> --no-comments
  ```
- `--comments-only`: Output only the discussion comments thread.
  ```sh
  ./.agents/skills/gh/scripts/gh-issue-view.sh <number> --comments-only
  ```

---

### 2. Run Ad-Hoc GitHub CLI Commands (`gh.sh`)

For general, ad-hoc `gh` queries (`pr list`, `run view`, `pr checks`), use the generic runner:

```sh
./.agents/skills/gh/scripts/gh.sh pr list --limit 10
./.agents/skills/gh/scripts/gh.sh run list --limit 5
```

**What it does**:
- Visibly echoes the executed command with cyan attribution.
- Automatically sets `GH_PROMPT_DISABLED=1` so processes never hang indefinitely on interactive prompts.
- Pipes output through `cat` if running in a TTY to prevent Glamour table/ANSI explosion.
- Preserves exit codes (`set -eo pipefail`).

---

### 3. Direct GitHub CLI Best Practices (Programmatic Tooling)

When writing automated scripts or querying GitHub CLI directly without helper scripts, follow these canons:

1. **Prefer `--json` and `--jq` for Machine Consumption**:
   When extracting specific fields, always request structured JSON rather than parsing terminal output:
   ```sh
   gh pr list --json number,title,headRefName,state
   gh issue view <id> --json title,body,labels -q '.title'
   ```
2. **Never Run Plain `gh issue view <id> --comments` in a PTY**:
   Direct terminal execution with comments will almost certainly trigger harness-level line truncation. Always use `gh-issue-view.sh` or pipe through `cat`.
3. **Multi-Remote Resolution**:
   Deliberate Lab uses a triangle workflow (`origin` fork, `upstream` canonical). Ensure a default remote is configured once:
   ```sh
   gh repo set-default PAIR-code/deliberate-lab
   ```
   *(Bonus: This writes to `.bare/config` and applies globally across all sibling worktrees).*

## Safety Rules

- **Never allow interactive prompts**: Keep `export GH_PROMPT_DISABLED=1` active in non-interactive agent sessions.
- **Do not shadow system binaries**: Never install a silent `gh` wrapper into `$PATH` or use relative PATH modifications. Always call scripts explicitly to preserve command provenance.
