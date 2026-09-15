---
number: 4
title: Repository Layer Taxonomy and Architectural Scoping
date: 2026-09-11
status: draft
deciders:
  - "@jimbojw"
  - "Antigravity"
area: area:workspace
supersedes: []
superseded_by: null
---

# 0004. Repository Layer Taxonomy and Architectural Scoping

## Context

As Deliberate Lab scales its AI-native developer workflows, contributors and coding agents routinely encounter cross-cutting operational boundaries:
- **`agents` Collision**: The legacy `agents` GitHub label lacked a description and created constant ambiguity between **in-experiment participant/mediator LLM agents** (a core application feature) and **developer-side AI coding agents** (e.g., Antigravity, `.agents/skills/`, `.agents/decisions/`).
- **Overloaded `process`**: The legacy `process` label served as an unstratified catch-all spanning workspace topology, git branch policies, monorepo build tooling, and CI/CD pipelines.
- **Toolchain Ambiguity**: Without an explicit architectural taxonomy, both human contributors and AI agents lacked immediate clarity on which layer a task touches and what toolchain rules apply. For example, workspace operations (like `workspace-overview` or `workspace-sync`) operate at the bare repository root and require only `git`, `gh`, and `bash`, whereas compilation and testing require navigating into hydrated worktree checkouts with `npm` and `node`.

## Decision

We establish a canonical **6-Layer Repository Taxonomy** dividing Deliberate Lab into five operational/dev-side layers and one partitioned runtime product layer.

### 1. The 6 Repository Layers

#### Operational & Dev-Side Layers

1. **Workspace Layer (`area:workspace`)**:
   - **Scope**: Bare repository layout (`.bare/`), sibling worktree topology, container-level symlinks, developer environment grounding (`workspace-overview`), synchronization and automated garbage collection (`workspace-sync`), maintainer PR evaluation sandboxes (`pr-<number>/` via `eval-pr`), agent pairing skills (`.agents/skills/`), and architecture decisions (`.agents/decisions/`).
   - **Toolchain**: `git`, `gh`, `bash`. Independent of project-level `npm` or `node_modules`.

2. **Branch & Git Layer (`area:git`)**:
   - **Scope**: Branch naming policies, trunk maintenance on `main`, Conventional Commits conventions, pull request review protocols (triage, gatekeeping manual verification steps, prompt-ready agent review feedback), merge policies, feature branch rebasing, and remote tracking (`origin` vs. `upstream`).
   - **Toolchain**: `git`, `gh`.

3. **Build & Style Layer (`area:build`)**:
   - **Scope**: Monorepo compilation (`utils/dist`, `functions/lib`), package exports, bundling (Webpack), formatting (Prettier), linting (ESLint flat config), and Husky pre-commit hooks.
   - **Toolchain**: `npm`, `tsc`, `eslint`, `prettier`.

4. **Test Layer (`area:test`)**:
   - **Scope**: Unit tests, integration tests, Firebase emulators, test fixtures, and test coverage.
   - **Toolchain**: `npm test`, Jest, Java 21 (for Firebase emulator).

5. **CI / Deployment Layer (`area:ci-deploy`)**:
   - **Scope**: GitHub Actions workflows (`.github/workflows/*`), Google Cloud Build (`cloudbuild.yaml`), deployment scripts, and release automation.
   - **Toolchain**: GitHub Actions, `gcloud`, deployment configs.

#### Product & Runtime Layers

6. **Runtime Layer (`runtime:*`)**:
   - **Scope**: The running Deliberate Lab web application, experiment engine, and backend services.
   - **Sub-areas**:
     - `runtime:participant-ux`: Participant stages, survey items, chat views, and user journeys.
     - `runtime:experimenter-ux`: Experimenter dashboard, cohort management, monitor views, and experiment configuration.
     - `runtime:agents`: In-experiment LLM participant agents, personas, and mediators (resolving the naming collision).
     - `runtime:backend`: Firebase Cloud Functions, Firestore data models, Firestore triggers, and Python backend services.

---

### 2. Toolchain Governance Matrix

| Layer | Primary Location | Primary Toolchain | Requires `npm ci`? |
| :--- | :--- | :--- | :--- |
| `area:workspace` | Container root (`deliberate-lab/`), `.agents/` | `git`, `gh`, `bash` | No |
| `area:git` | Git refs, worktree topology | `git`, `gh` | No |
| `area:build` | Monorepo checkouts, package root | `node` (v22), `npm`, `tsc` | Yes |
| `area:test` | Monorepo checkouts, `emulator_test_config/` | `npm test`, Jest, Java 21 | Yes |
| `area:ci-deploy` | `.github/workflows/`, `cloudbuild.yaml` | YAML, GitHub Actions, `gcloud` | No |
| `runtime:*` | `frontend/`, `functions/`, `utils/`, `firestore/` | Lit, MobX, Firebase, TypeScript | Yes |

---

### 3. GitHub Label Catalog & Migration Specification

To align repository metadata with this taxonomy, GitHub issue labels on `PAIR-code/deliberate-lab` are standardized as follows:

| Label Name | Description | Color | Action |
| :--- | :--- | :--- | :--- |
| `area:workspace` | Bare repository layout, worktrees, PR evaluation sandboxes, workspace scripts, and decision records | `#1D76DB` | Create |
| `area:git` | Git workflows, PR review protocols, branch policies, trunk sync, conventional commits, and remotes | `#5319E7` | Create |
| `area:build` | Monorepo compilation, packaging, linting, formatting, and pre-commit hooks | `#F9D0C4` | Create |
| `area:test` | Unit tests, integration tests, Firebase emulators, and test runners | `#006B75` | Create |
| `area:ci-deploy` | GitHub Actions workflows, Cloud Build, deployment scripts, and release automation | `#D93F0B` | Create |
| `runtime:participant-ux` | Participant stages, survey items, chat views, and user journeys | `#EF2482` | Rename `participant UX` |
| `runtime:experimenter-ux` | Experimenter dashboard, cohort management, and experiment configuration | `#AAAAAA` | Rename `experimenter UX` |
| `runtime:agents` | In-experiment LLM participant agents, personas, and mediators | `#F1A741` | Rename `agents` |
| `runtime:backend` | Firebase Cloud Functions, Firestore data models, and Python backend services | `#0E8A16` | Create |
| `process` | Legacy catch-all process label; prefer specific `area:*` labels | `#B2C75A` | Update description |

#### Reification Decoupling
Adopting this decision defines the architectural canon in git. Live upstream label modifications on GitHub (`PAIR-code/deliberate-lab`) must not be executed while the PR proposing this decision is in review. Reification is deferred to a dedicated post-merge chore issue blocked on this PR.

## Consequences

- **Unambiguous Terminology**: "Agents" exclusively refers to in-experiment LLM participant agents (`runtime:agents`), while developer AI tooling is scoped to `area:workspace` and `.agents/`.
- **Targeted Fast-Follows**: Post-Action Reviews (e.g. following the retrospective skill) can immediately classify papercuts and fast-follow issues into the appropriate architectural layer.
- **Predictable Toolchain Requirements**: Agents and developers know whether a task requires setting up `node_modules` and building `utils/dist` or can be executed purely with git/gh tooling.

