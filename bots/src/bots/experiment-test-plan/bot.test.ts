import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {ExperimentTestPlanBot} from './bot.js';
import {formatTopologyItem, renderTestPlanComment} from './renderer.js';
import type {ExperimentTestPlanEvaluation} from './types.js';
import type {PRContext} from '../../core/types.js';

const mockContext: PRContext = {
  owner: 'PAIR-code',
  repo: 'deliberate-lab',
  prNumber: 999,
  title: 'feat(stage): add new QuizStage component',
  body: 'Implements the QuizStage for participants.',
  author: 'contributor',
  baseRef: 'main',
  headRef: 'feature/quiz-stage',
  headSha: '1234567890abcdef',
  isDraft: false,
  labels: ['feature'],
  files: [
    {
      filename: 'frontend/src/stages/quiz_stage.ts',
      status: 'added',
      additions: 120,
      deletions: 0,
      changes: 120,
      patch: '+export class QuizStage extends BaseStage {}',
    },
  ],
};

describe('ExperimentTestPlanBot', () => {
  const bot = new ExperimentTestPlanBot();

  it('has correct id and name', () => {
    assert.equal(bot.id, 'experiment-test-plan');
    assert.match(bot.name, /Experiment Test Plan Assistant/);
  });

  it('skips draft PRs and runs on ready PRs', () => {
    assert.equal(bot.shouldRun({...mockContext, isDraft: true}), false);
    assert.equal(bot.shouldRun({...mockContext, isDraft: false}), true);
  });

  it('fails closed when GEMINI_API_KEY is not set', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const evaluation = await bot.evaluate(mockContext);
      assert.equal(evaluation.status, 'warn');
      assert.match(evaluation.summary, /GEMINI_API_KEY/);
      assert.equal(evaluation.metadata?.missingApiKey, true);

      const comment = bot.renderComment(mockContext, evaluation);
      assert.match(comment, /Missing `GEMINI_API_KEY`/);
      assert.match(comment, /failed closed cleanly/);
    } finally {
      if (originalKey) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  it('renders non-runtime change comment correctly (Tier 2)', () => {
    const nonRuntimeEval: ExperimentTestPlanEvaluation = {
      isRuntimeBehaviorChange: false,
      classificationRationale:
        'Only documentation and CI workflow changes were detected.',
      hasManualTestPlan: false,
      missingElements: [],
    };

    const comment = renderTestPlanComment(nonRuntimeEval);
    assert.match(comment, /Non-Runtime Change Detected/);
    assert.match(comment, /Manual experiment verification is not required/);
  });

  it('renders verified plan comment correctly (Tier 3)', () => {
    const verifiedEval: ExperimentTestPlanEvaluation = {
      isRuntimeBehaviorChange: true,
      classificationRationale: 'Adds new quiz stage.',
      hasManualTestPlan: true,
      manualPlanDetails: {
        experimentTemplate: 'Chat and Quiz Template',
        stagesSequence: 'Profile -> Quiz -> Chat -> Survey',
        humanParticipants: '2',
        agentMediator: 'None',
        agentParticipants: '1 agent persona',
        participantActions: 'Complete quiz and observe score persistence',
        successCriteria: 'Score saves to participant variables cleanly',
      },
      missingElements: [],
    };

    const comment = renderTestPlanComment(verifiedEval);
    assert.match(comment, /Manual Experiment Test Plan Verified/);
    assert.match(comment, /Chat and Quiz Template/);
    assert.match(comment, /Score saves to participant variables/);
  });

  it('renders draft tentative plan for reviewers when deduced (Tier 4, Passes CI)', () => {
    const deducedEval: ExperimentTestPlanEvaluation = {
      isRuntimeBehaviorChange: true,
      classificationRationale:
        'Introduces new QuizStage runtime component without test plan.',
      hasManualTestPlan: false,
      missingElements: ['stagesSequence', 'participantActions'],
      canDeducePlan: true,
      suggestedTentativePlan: {
        experimentTemplate: 'Default Experiment',
        stagesSequence: 'QuizStage -> SurveyStage',
        humanParticipants: '1 Human',
        agentMediator: 'None',
        agentParticipants: 'None',
        participantActions: 'Submit answers in QuizStage',
        successCriteria: 'Survey stage unlocks upon submission',
      },
    };

    const comment = renderTestPlanComment(deducedEval);
    assert.match(
      comment,
      /Draft Manual Experiment Test Plan \(Ready for Review\)/,
    );
    assert.match(comment, /Suggested Test Plan/);
    assert.match(comment, /QuizStage -> SurveyStage/);
    assert.match(comment, /Survey stage unlocks upon submission/);
    assert.match(comment, /CI Status: Passed/);
  });

  it('renders guidance required comment when code is too ambiguous to deduce (Tier 5, Blocks CI)', () => {
    const opaqueEval: ExperimentTestPlanEvaluation = {
      isRuntimeBehaviorChange: true,
      classificationRationale:
        'Alters internal participant state machine transition algorithms.',
      hasManualTestPlan: false,
      missingElements: [
        'stagesSequence',
        'participantActions',
        'successCriteria',
      ],
      canDeducePlan: false,
      guidanceNeededReason:
        'State transitions are deeply coupled to custom event bus logic with no UI cues.',
    };

    const comment = renderTestPlanComment(opaqueEval);
    assert.match(comment, /Manual Experiment Test Plan Guidance Required/);
    assert.match(comment, /Why Author Guidance Is Needed/);
    assert.match(
      comment,
      /State transitions are deeply coupled to custom event bus/,
    );
    assert.match(comment, /CI Status: Blocked/);
    assert.match(comment, /issues\/new\?/);
  });

  it('renders upstream error comment with mitigation steps and bug report link (Tier 1)', () => {
    const errorComment = bot.renderComment(mockContext, {
      status: 'warn',
      summary: 'API quota exceeded (503 Service Unavailable)',
      details: 'Preempted out of decode queue',
    });

    assert.match(errorComment, /Evaluation Blocked: Upstream Service Error/);
    assert.match(errorComment, /API quota exceeded/);
    assert.match(errorComment, /Preempted out of decode queue/);
    assert.match(errorComment, /How to Re-run/);
    assert.match(errorComment, /Re-run all jobs/);
    assert.match(errorComment, /issues\/new\?/);
    assert.match(errorComment, /area%3Aci-deploy/);
  });

  describe('formatTopologyItem', () => {
    it('formats single-line values correctly', () => {
      const formatted = formatTopologyItem(
        1,
        'Experiment Template',
        'Default Experiment',
      );
      assert.equal(formatted, '1. **Experiment Template**: Default Experiment');
    });

    it('normalizes literal \\n and indents numbered sub-steps with 3 spaces', () => {
      const raw = '1. Open editor\\n2. Add stage\\n3. Click save';
      const formatted = formatTopologyItem(6, 'Tester Actions', raw);
      assert.equal(
        formatted,
        '6. **Tester Actions**:\n   1. Open editor\n   2. Add stage\n   3. Click save',
      );
    });

    it('indents bullet points with 3 spaces', () => {
      const raw = '- First action\n- Second action';
      const formatted = formatTopologyItem(6, 'Tester Actions', raw);
      assert.equal(
        formatted,
        '6. **Tester Actions**:\n   - First action\n   - Second action',
      );
    });

    it('splits inline numbered steps into indented sub-steps', () => {
      const raw = '1. First step 2. Second step 3. Third step';
      const formatted = formatTopologyItem(6, 'Tester Actions', raw);
      assert.equal(
        formatted,
        '6. **Tester Actions**:\n   1. First step\n   2. Second step\n   3. Third step',
      );
    });

    it('handles undefined or empty values gracefully', () => {
      assert.equal(
        formatTopologyItem(4, 'Agent Mediator', undefined),
        '4. **Agent Mediator**: None / Not specified',
      );
    });
  });
});
