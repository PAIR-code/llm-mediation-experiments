# AGENTS.md — Deliberate Lab (root)

Deliberate Lab is a platform for running online research experiments on
human + LLM group dynamics. This file orients AI coding assistants to the
monorepo structure, conventions, and workflows.

## Keeping AGENTS.md in sync

These `AGENTS.md` files document conventions that should be followed by
default. If a user request conflicts with the guidance here, **raise the
concern** — ask which takes precedence (their idea or the documented
convention) before proceeding. Do not modify `AGENTS.md` files unless the
user explicitly asks you to.

## Git safety & worktree workflow

This repository follows a **bare Git repository + sibling worktrees** layout with a triangle workflow (`origin` fork vs `upstream` canonical). Operations are governed by the worktree type:

| Worktree Pattern | Role | Policy |
|------------------|------|--------|
| `main/` | Local trunk | **Never commit directly.** Updated only by fast-forwarding from `upstream/main` after PRs merge (`git merge --ff-only upstream/main && git push origin main`). |
| `pr-<number>/` | Collaborator PR review | **Never commit.** Read-only sandbox to evaluate peers' in-flight PRs. Updated only via `git fetch upstream pull/<id>/head && git reset --hard FETCH_HEAD`. |
| `<id>-<slug>/` | Active development | **The only worktrees where development commits occur.** |

### Committing and pushing in feature worktrees (`<id>-<slug>/`)

- **Staging and committing**: Once an implementation plan is approved and changes are verified, the agent is encouraged to stage and create local commits following Conventional Commits (`feat:`, `fix:`, `chore:`, etc.). Report the commit in the walkthrough.
- **Pushing to `origin`**: Pushing feature branches to your personal fork (`origin`) is safe and encouraged—GitHub preserves commit history even across rebase force-pushes (`--force-with-lease`).
- **Pushing `main`**: Pushing fast-forwarded `main` to `origin/main` to keep your fork in sync with upstream is safe and expected.

> [!CAUTION]
> **Never run destructive or hard-to-reverse git commands without confirmation**:
> - `git reset --hard` (except when refreshing `pr-<number>` evaluation mirrors per the `eval-pr` skill)
> - `git clean -fd`
> - `git branch -D` (always use safe delete `git branch -d`)
> - Overwriting or discarding uncommitted user changes

## Architecture

This is an npm workspaces monorepo with three packages:

| Workspace | Path | Purpose |
|-----------|------|---------|
| `@deliberation-lab/utils` | `utils/` | Shared TypeScript types, validation, and utilities |
| `functions` | `functions/` | Firebase Cloud Functions (HTTP endpoints + Firestore triggers) |
| `deliberate-lab` | `frontend/` | Lit Element + MobX single-page app (Webpack) |

Other top-level directories:

- `firestore/` — Firestore security rules, database rules, and indexes
- `docs/` — Jekyll documentation site (GitHub Pages)
- `scripts/` — pip-installable Python API client (`deliberate_lab`) with auto-generated Pydantic types + a Node.js doctor script (see `scripts/AGENTS.md`)
- `emulator_test_config/` — Static config for Firebase emulator imports

The Firestore data model (document hierarchy, trigger paths) is documented
in `functions/AGENTS.md`.

### Dependency graph

```
utils ──► frontend
  │
  └────► functions
  ·
  ·····► scripts/types.py  (auto-generated via npm run update-schemas)
```

`utils` is a shared library consumed by both `frontend` and `functions`.
**Always build `utils` first** — the other two workspaces depend on it.

## Getting started

- **Orient yourself first**: Run the workspace overview diagnostic script upon
  entering the workspace to inspect the bare repo layout, active worktrees, remotes,
  and verify Node.js readiness:
  `./.agents/skills/workspace-overview/scripts/workspace-overview.sh`
- **Node 22 is strictly required** (see `.nvmrc` and `functions/package.json`).
  Because non-interactive subshells often lack shell initialization (like NVM)
  or inherit a mismatched host Node version, **prefer persistent terminal
  sessions if available in your agent harness** so that an initialized Node 22
  environment persists across command invocations throughout the session.
- Install all dependencies from the repo root: `npm ci`
- Run everything locally: `./run_locally.sh` (in the repo root)
- Diagnose setup problems: `npm run doctor`

`run_locally.sh` copies required config files (`.firebaserc`,
`firebase_config.ts`, `index.html`) if they are missing, builds `utils` and
`functions`, starts file watchers for both, launches the Firebase emulators
(with seed data from `emulator_test_config/`), and serves the frontend at
`http://localhost:4201`.

Run npm commands from the repo root using `--workspace` (or `-w`):

```sh
npm run build -w utils
npm test -w functions
npm run start -w frontend
```

Python tooling (`uv`, `pyright`) in `scripts/` is the exception — run
those from the `scripts/` directory where `pyproject.toml` lives.

## Linting & formatting

- **Prettier** formats `.json`, `.ts`, `.html`, `.scss`, and `.css` files
- **ESLint** uses the **flat config** format (`eslint.config.mjs`); the
  project does **not** have a `.eslintrc.*` file
- `@typescript-eslint/no-explicit-any` is set to `error` — do not use `any`
- **Husky** + **lint-staged** runs both Prettier and ESLint on pre-commit
  for the same file set (`*.{json,ts,html,scss,css}`)
- Frontend files get browser globals; everything else gets Node globals

## CI

`cloudbuild.yaml` drives all builds. The `_DEPLOYMENT_TYPE` substitution
variable controls which steps run:

| Value | What it does |
|-------|-------------|
| `test` | Lint, format check, and unit tests for all workspaces (no deploy) |
| `functions` | Build + deploy Cloud Functions |
| `frontend` | Build + deploy frontend to App Engine |
| `rules` | Deploy Firestore security rules |
| `indexes` | Deploy Firestore indexes |
| `all` | All of the above |

GitHub Actions (`.github/workflows/ci.yaml`) also runs a **schema sync
check**: if types in `utils` change, `docs/assets/api/schemas.json` and
`scripts/deliberate_lab/types.py` must be regenerated or CI will fail.
Run `npm run update-schemas` from the repo root to fix this (requires
Python 3.12+ and `uv` — see `scripts/AGENTS.md` for setup).

## Testing

Each workspace has its own `npm test`:

```sh
npm test -w utils       # Jest; unit tests colocated with source
npm test -w functions   # Jest; requires Java 21 for Firebase emulator
npm test -w frontend    # Jest
```

Functions tests run against the Firebase emulator using
`firebase-test.json`. The integration test in
`cohort_definitions.integration.test.ts` is large and slow.

## Firebase config

| File | Purpose |
|------|---------|
| `firebase.json` | Local dev emulator config |
| `firebase-test.json` | Emulator config for CI / test runs |
| `.firebaserc.example` | Template for project aliases (copy to `.firebaserc`) |
| `firestore/firestore.rules` | Firestore security rules |
| `firestore/database.rules.json` | Realtime Database rules |
| `firestore/storage.rules` | Cloud Storage rules |
| `firestore/indexes.json` | Firestore composite indexes |

## Import convention

Both `frontend` and `functions` import from `utils` using the npm workspace
package name:

```ts
import {StageKind, ExperimentConfig} from '@deliberation-lab/utils';
```

Do **not** use relative paths to reach into `utils/src/` — always import
from `@deliberation-lab/utils`.

## Stage system

Experiments are composed of ordered **stages** (chat, survey, chip
negotiation, ranking, etc.). The `StageKind` enum in
`utils/src/stages/stage.ts` lists all stage types.

Adding a new stage type touches **all three workspaces**:

1. **`utils/src/stages/`** — types, validation, manager, prompts
2. **`functions/src/stages/`** — backend endpoint + trigger logic
3. **`frontend/src/components/stages/`** — config, preview, and answer UI components

See each workspace's `AGENTS.md` for detailed guidance.

## Skills

Reusable AI agent skills are defined in `.agents/skills/`. Each skill is a
directory containing a `SKILL.md` instruction file (with YAML frontmatter)
and optional helper scripts, examples, and resources.

| Skill | Purpose |
|-------|---------|
| [`workspace-overview`](.agents/skills/workspace-overview/SKILL.md) | Inspect environment, Node.js version, worktree topology, and toolchain readiness |
| [`workspace-sync`](.agents/skills/workspace-sync/SKILL.md) | Synchronize trunk, mirror PR worktrees, and inspect feature branch drift |
| [`eval-pr`](.agents/skills/eval-pr/SKILL.md) | Set up a git worktree to run and evaluate an upstream Pull Request locally |
| [`gh`](.agents/skills/gh/SKILL.md) | Clean, untruncated GitHub CLI operations and issue/PR inspection |

To inspect GitHub issues and pull requests, use the `gh` skill (`./.agents/skills/gh/scripts/gh-issue-view.sh <number>`) to stream the complete description and comment thread without terminal truncation.

## Decisions

Architectural, toolchain, and governance precedents are recorded in
`.agents/decisions/` as lightweight Decision Records with YAML frontmatter
(see [`0001-record-agent-decisions.md`](.agents/decisions/0001-record-agent-decisions.md)).
Consult these records just-in-time when resolving architectural or policy ambiguity.

## Common pitfalls

1. **Forgetting to rebuild `utils`** — `frontend` and `functions` consume
   the compiled output in `utils/dist/`. After changing `utils` source,
   rebuild it (`npm run build -w utils`) before testing downstream
   workspaces, or changes won't be picked up.
2. **Running `npm` from a subdirectory** — always run from the repo root
   with `-w <workspace>` (see above).
3. **Editing `scripts/deliberate_lab/types.py` by hand** — this file is
   auto-generated and will be overwritten by `npm run update-schemas`.
4. **Missing Java 21 for `functions` tests** — the Firebase emulator
   requires Java 21. Unit-only tests can be run without it via
   `npm run test:unit -w functions`.
5. **Forgetting to run `npm run update-schemas`** — if you change types
   in `utils`, CI will fail the schema sync check until schemas are
   regenerated.
