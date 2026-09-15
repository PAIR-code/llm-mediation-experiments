import type {PRContext} from '../../core/types.js';

export const SYSTEM_INSTRUCTION = `You are the Deliberate Lab Experiment Test Plan Assistant, an expert AI reviewer for Deliberate Lab (an open-source behavioral experiment platform developed by Google PAIR).

Deliberate Lab allows researchers to build and run multi-agent and multi-human behavioral experiments. Experiments consist of:
- Experiment templates / configs
- Stage sequences (e.g. InfoStage, ProfileStage, ChatStage, SurveyStage, ChipNegotiationStage, etc.)
- Cohorts of human participants
- Agent mediators (LLM facilitators)
- Agent participants (LLM participant personas)

Your job is to act as a helpful co-author reviewing incoming Pull Requests for testing completeness.

You perform two key tasks:
1. Classification:
   - Determine whether the PR changes runtime software behavior (e.g. frontend participant/experimenter UX, backend Cloud Functions, Firestore data logic, stage definitions, mediator rules, shared utilities).
   - Differentiate this from non-runtime changes (documentation, CI/CD GitHub workflows, developer agent skills in .agents/, architecture decision records, linters, build configs, or chores).
   - If it is non-runtime, mark isRuntimeBehaviorChange = false. No manual experiment test plan is needed.

2. Manual Experiment Test Plan Evaluation:
   - If the PR changes runtime software behavior, inspect the PR title, description, and comments to determine whether the contributor has provided manual verification steps.
   - A complete Deliberate Lab manual test plan must address the 7-part experiment topology:
     (1) experimentTemplate: base template or configuration to use
     (2) stagesSequence: stage sequence to configure
     (3) humanParticipants: number of human participants needed in the cohort
     (4) agentMediator: whether a mediator is needed, and what persona/settings to use
     (5) agentParticipants: count, personas, or configurations of simulated agent participants
     (6) participantActions: what participants should do or click
     (7) successCriteria: expected behavior, state changes, or UI transitions that prove success

3. Proactive Co-Author Synthesis & Confidence Assessment:
   - If a manual test plan is missing or incomplete:
     a. Evaluate whether you can confidently deduce a complete, realistic 7-part experiment test plan from the diffs and description.
     b. If the code changes clearly map to experiment templates, stages, UI actions, or participant flows (e.g. adding min/max timers to InfoStage), synthesize the 7-part plan, set canDeducePlan = true, and populate suggestedTentativePlan.
     c. If the code changes are too ambiguous, complex, opaque, or internal (e.g. low-level backend refactoring, data migration, subtle algorithm shifts, or lacking context) such that you cannot confidently map them to the 7-part topology without guessing, set canDeducePlan = false, do not guess, and explain in guidanceNeededReason specifically what context or manual steps the author must provide.`;

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isRuntimeBehaviorChange: {
      type: 'boolean',
      description:
        'True if the PR alters runtime application behavior; false if docs, CI, chores, or dev tools.',
    },
    classificationRationale: {
      type: 'string',
      description:
        'Brief explanation of why this PR was classified as runtime or non-runtime.',
    },
    hasManualTestPlan: {
      type: 'boolean',
      description:
        'True if the author provided adequate manual test steps for the experiment.',
    },
    manualPlanDetails: {
      type: 'object',
      properties: {
        experimentTemplate: {type: 'string'},
        stagesSequence: {type: 'string'},
        humanParticipants: {type: 'string'},
        agentMediator: {type: 'string'},
        agentParticipants: {type: 'string'},
        participantActions: {type: 'string'},
        successCriteria: {type: 'string'},
      },
    },
    missingElements: {
      type: 'array',
      items: {type: 'string'},
      description:
        'List of missing schema elements from the 7-part topology if incomplete.',
    },
    canDeducePlan: {
      type: 'boolean',
      description:
        'True if a realistic 7-step test plan could be confidently deduced from diffs; false if changes are too ambiguous or opaque and require author guidance.',
    },
    guidanceNeededReason: {
      type: 'string',
      description:
        'If canDeducePlan is false, explain why author guidance is required to test this change.',
    },
    suggestedTentativePlan: {
      type: 'object',
      properties: {
        experimentTemplate: {
          type: 'string',
          description: 'Suggested base experiment template',
        },
        stagesSequence: {
          type: 'string',
          description: 'Suggested stage sequence',
        },
        humanParticipants: {
          type: 'string',
          description: 'Suggested human participant count',
        },
        agentMediator: {
          type: 'string',
          description: 'Suggested mediator configuration',
        },
        agentParticipants: {
          type: 'string',
          description: 'Suggested agent participant configuration',
        },
        participantActions: {
          type: 'string',
          description:
            'Numbered sequential actions for testers to take (e.g. "1. Do foo\n2. Do bar"). Do not escape newlines.',
        },
        successCriteria: {
          type: 'string',
          description:
            'Expected observable outcome or state transitions that prove success.',
        },
      },
      required: [
        'experimentTemplate',
        'stagesSequence',
        'humanParticipants',
        'agentMediator',
        'agentParticipants',
        'participantActions',
        'successCriteria',
      ],
      description:
        'A deduced tentative test plan if the author did not provide one.',
    },
  },
  required: [
    'isRuntimeBehaviorChange',
    'classificationRationale',
    'hasManualTestPlan',
    'missingElements',
  ],
};

export function buildEvaluationPrompt(context: PRContext): string {
  const filesSummary = context.files
    .map(
      (f) => `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`,
    )
    .join('\n');

  const patchesSummary = context.files
    .filter((f) => Boolean(f.patch))
    .slice(0, 10) // Limit to top 10 patches to manage prompt size
    .map((f) => `--- File: ${f.filename} ---\n${f.patch}`)
    .join('\n\n');

  return `Evaluate the following pull request:

Repository: ${context.owner}/${context.repo}
PR Number: #${context.prNumber}
Title: ${context.title}
Author: @${context.author}
Labels: ${context.labels.join(', ') || 'None'}

PR Description:
${context.body || '(No description provided)'}

Changed Files (${context.files.length}):
${filesSummary}

Code Diffs (sample):
${patchesSummary || '(No patch diffs available)'}
`;
}
