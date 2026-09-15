---
name: retrospective
description: >
  Reflect on pairing sessions from the AI perspective using the FAR framework
  (Friction, Ambiguity, Repetition), present observations conversationally,
  and anchor generalizable improvements as GitHub issues or comments.
---

# Retrospective

A skill for AI coding agents to reflect on recent pairing sessions, capture operational learnings from the agent's perspective, and anchor generalizable improvements into concrete GitHub issues or comments—without in-flight scope creep.

---

## When to use

Invoke this skill when:
- Completing a Pull Request or major feature milestone before final sign-off.
- Wrapping up an exploratory or pairing session.
- The developer asks for reflection: "run a retro", "what friction did you hit?", "post-action review", "reflect on this session".

---

## Core Principles

### 1. The AI Perspective: The FAR Lens

Analyze the pairing trajectory through three dimensions:

| Dimension | What the AI Experiences | Examples in Deliberate Lab |
| :--- | :--- | :--- |
| **Friction** | Tooling & environment failures | Non-zero exit codes, missing build artifacts (`utils/dist`), buffer truncations, misaligned Node versions. |
| **Ambiguity** | Context & governance gaps | Underspecified worktree policies, unclear layer boundaries, missing decision records, conflicting instructions. |
| **Repetition** | Toil & token inefficiency | Multi-step bash ceremonies that waste round-trips and should be scripted or automated. |

### 2. The Triage Gate: Transient vs. Generalizable

Before recommending action, filter each observation:

> *"The cure may be worse than the disease."*

- **Transient / Anomalous Friction**: One-off edge cases, network blips, or temporary bootstrapping phases (e.g. working within an active stacked PR chain that temporarily alters symlinks).
  - *Action*: Mention it conversationally, but explicitly recommend **not** building tooling or over-engineering rules.
- **Generalizable / Systemic Friction**: Friction that will predictably recur across future agent sessions or for other contributors (e.g. multi-remote CLI ambiguity, uncodified PR review protocols, missing build artifacts).
  - *Action*: Escalate to formal **Anchoring**.

### 3. The Cardinal Rule: Anchoring (No In-Flight Fixes)

> [!CRITICAL]
> **Never apply workflow, tooling, or governance fixes directly onto an active feature branch during a feature task.**

Ad-hoc workflow fixes during feature work bloat PR diffs, mix concerns, and discard provenance. Instead, route generalizable insights to appropriate capture methods:

1. **New GitHub Issue** *(Most common)*:
   - For concrete bugs, missing tooling scripts, or independent fast-follow tasks.
   - Classify using Deliberate Lab's 6 repository layers ([Decision 0004](../../decisions/0004-repository-layer-taxonomy.md)):
     - `area:workspace` (bare repo, worktrees, overview, sync, decisions, eval-pr)
     - `area:git` (branch policies, conventional commits, remotes, PR review protocols)
     - `area:build` (monorepo compilation, packaging, linting, formatting)
     - `area:test` (unit & integration tests, emulators)
     - `area:ci-deploy` (GitHub Actions, Cloud Build)
     - `runtime:*` (`runtime:participant-ux`, `runtime:experimenter-ux`, `runtime:agents`, `runtime:backend`)
2. **Comment on Existing Issue or PR**:
   - For direct UX/design feedback, nuance, or implementation notes on the current feature.
3. **Decision Record (`.agents/decisions/`)**:
   - When the session yields an architectural trade-off, governance verdict, or engineering precedent ([ADR 0001](../../decisions/0001-record-agent-decisions.md)).

#### The Anti-Bloat Canon ([ADR 0002](../../decisions/0002-prefer-self-diagnosing-scripts.md))
Never default to expanding `AGENTS.md` with static troubleshooting checklists. Prioritize active script detection and stdout remediation over documentation prose.

### 4. Capturing Negative Decision Space (Overturned Proposals)

To prevent the **"Groundhog Day" trap**—where future agents repeatedly suggest the same obvious-sounding but unwanted mitigations—explicitly note proposals that the developer declined:
- What the agent recommended.
- Why the developer overturned it (e.g. premature abstraction, operational overhead exceeds benefit, transient anomaly).

Preserving this rationale in the retro discussion or resulting issue prevents future agents from retreading rejected ideas.

---

## Trajectory Telemetry Mining

Ground the reflection in objective signals from the session transcript:
1. **User Course-Corrections**: Direct user interventions steering architecture, correcting assumptions, or advising against editing a file. *These are the highest-value signals of underlying context ambiguity.*
2. **Command / Tool Failures**: Non-zero exits, failed bash commands, or output truncation traps.
3. **Repetitive Operations**: Multi-step terminal ceremonies repeated multiple times across the session.

---

## Conversational Delivery (No Rigid Forms)

Do **not** output a rigid boilerplate report or fill out empty template sections. Instead, conduct the retrospective conversationally:

1. **Brief Debrief**: Share a concise, candid summary of what the session felt like from the AI perspective:
   - What went smoothly.
   - What friction, ambiguity, or repetition occurred (and which are transient vs. generalizable).
   - Any overturned proposals (negative decision space).
2. **Actionable Recommendations**: For the generalizable concerns, present concrete capture recommendations such as a new GitHub issue or comment on an existing issue.
3. **User Confirmation**: Ask the developer whether they agree with the triage and want to file the recommended issues/comments.

---

## Safety Rules

- **Zero In-Flight Code Changes**: A retrospective never makes unreviewed code changes to the active feature code. It only produces conversational reflection and drafts capture items.
- **Fluff-Free**: Avoid mechanical boilerplate headings (e.g. writing "User Course-Corrections: None"). Only report genuine signals.
- **Respect User Intent**: Human course-corrections are authoritative; treat them as primary learning inputs.
