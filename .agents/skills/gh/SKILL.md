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

### 1. View an Issue (`gh-issue-view.sh`)

To inspect a GitHub Issue with its complete description and all comments:

```sh
./.agents/skills/gh/scripts/gh-issue-view.sh <number>
```

*(From a sibling worktree directory, call `../.agents/skills/gh/scripts/gh-issue-view.sh <number>` or from repository root).*

**Features**:
- **Command Provenance**: Visibly echoes the underlying commands in cyan (`$ gh issue view ... | cat`) before execution.
- **Complete Context**: Streams the issue description first, followed by the complete discussion thread.
- **Compact Payload**: Bypasses Glamour so that even extensive issues fit comfortably in 5–10 KB with zero truncation.

**Optional Flags**:
- `--no-comments`: Output only the issue header and description.
  ```sh
  ./.agents/skills/gh/scripts/gh-issue-view.sh <number> --no-comments
  ```
- `--comments-only`: Output only the discussion comments thread.
  ```sh
  ./.agents/skills/gh/scripts/gh-issue-view.sh <number> --comments-only
  ```

---

### 2. View a Pull Request with CI Checks & Inline Reviews (`gh-pr-view.sh`)

In GitHub CLI, `gh pr view` has a major blind spot: it does **not** display CI check statuses, and even with `--comments`, it completely ignores **inline code review comments** left on changed files.

To inspect a Pull Request with complete metadata, CI checks, PR discussion, and line-level code reviews in a single clean payload:

```sh
./.agents/skills/gh/scripts/gh-pr-view.sh <number>
```

**What it orchestrates**:
1. **Metadata & Description**: `$ gh pr view <id> | cat` (branches, status, additions/deletions, summary).
2. **CI Status & Checks**: `$ gh pr checks <id> | cat` (lists test runs, format checks, schema validations).
3. **PR Discussion**: `$ gh pr view <id> --comments | cat` (general conversational thread).
4. **Inline Code Reviews**: `$ gh api repos/{owner}/{repo}/pulls/<id>/comments` (formats line-level review comments as `[path:line] author: body`).

**Optional Flags**:
- `--checks-only`: Only display CI check statuses.
- `--reviews-only`: Only display inline code review comments.
- `--comments-only`: Only display general discussion comments.
- `--no-checks`: Skip CI checks.
- `--no-reviews`: Skip inline code review comments.
- `--no-comments`: Skip general discussion comments.

---

### 3. The Complexity Boundary: When to Script vs. Use Raw `gh`

We draw a deliberate engineering boundary regarding GitHub CLI tooling:
- **Dedicated Scripts for Complex Synthesis**: When an operation requires synthesizing multiple fragmented endpoints or bypassing severe terminal traps (such as `gh-issue-view.sh` to prevent Glamour truncation and merge comments, or `gh-pr-view.sh` to orchestrate metadata, CI checks, discussion, and inline code reviews), use the dedicated skill scripts.
- **Raw `gh` for Routine Commands**: For standard, single-step operations (e.g. `gh pr create`, `gh pr edit`, `gh issue comment`), use standard `gh` directly without redundant wrapper layers.

### 4. Direct GitHub CLI Best Practices (Programmatic Tooling)

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
