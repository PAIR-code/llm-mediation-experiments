import type {BotEvaluation, PRContext, PRReviewBot} from '../../core/types.js';
import {
  callGeminiStructured,
  hasGeminiApiKey,
} from '../../core/gemini-client.js';
import type {ExperimentTestPlanEvaluation} from './types.js';
import {
  buildEvaluationPrompt,
  RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION,
} from './prompt.js';
import {renderErrorComment, renderTestPlanComment} from './renderer.js';

export class ExperimentTestPlanBot implements PRReviewBot {
  readonly id = 'experiment-test-plan';
  readonly name = 'Deliberate Lab • Experiment Test Plan Assistant';

  shouldRun(context: PRContext): boolean {
    // Automatically skip draft PRs until marked ready for review
    if (context.isDraft) {
      return false;
    }
    return true;
  }

  async evaluate(context: PRContext): Promise<BotEvaluation> {
    // Fail-closed validation if GEMINI_API_KEY is not configured
    if (!hasGeminiApiKey()) {
      return {
        status: 'warn',
        summary: 'GEMINI_API_KEY secret is not configured in this environment.',
        metadata: {missingApiKey: true},
      };
    }

    const prompt = buildEvaluationPrompt(context);

    try {
      const evaluation =
        await callGeminiStructured<ExperimentTestPlanEvaluation>({
          systemInstruction: SYSTEM_INSTRUCTION,
          prompt,
          responseSchema: RESPONSE_SCHEMA,
        });

      // Tier 2: Non-runtime change (passes cleanly)
      if (!evaluation.isRuntimeBehaviorChange) {
        return {
          status: 'pass',
          summary: 'Non-runtime change (manual test plan not required).',
          metadata: {evaluation, tier: 2},
        };
      }

      // Tier 3: Runtime change with verified author test plan (passes cleanly)
      if (evaluation.hasManualTestPlan) {
        return {
          status: 'pass',
          summary: 'Manual experiment test plan verified.',
          metadata: {evaluation, tier: 3},
        };
      }

      // Tier 4: Runtime change with confidently deduced tentative plan (passes cleanly)
      const hasDeducedPlan =
        evaluation.canDeducePlan !== false &&
        Boolean(evaluation.suggestedTentativePlan);

      if (hasDeducedPlan) {
        return {
          status: 'pass',
          summary:
            'Draft manual experiment test plan synthesized from code changes (ready for review).',
          metadata: {evaluation, tier: 4},
        };
      }

      // Tier 5: Runtime change lacking plan, guidance needed (fails closed)
      return {
        status: 'warn',
        summary:
          evaluation.guidanceNeededReason ||
          'Manual experiment test plan required from author (unable to deduce from diffs).',
        metadata: {evaluation, tier: 5},
      };
    } catch (err) {
      return {
        status: 'warn',
        summary: `Evaluation error encountered: ${(err as Error).message}`,
        details: (err as Error).stack,
        metadata: {tier: 1},
      };
    }
  }

  renderComment(context: PRContext, evaluation: BotEvaluation): string {
    if (evaluation.metadata?.missingApiKey) {
      return renderTestPlanComment(
        {
          isRuntimeBehaviorChange: true,
          classificationRationale: '',
          hasManualTestPlan: false,
          missingElements: [],
        },
        {missingApiKey: true, context},
      );
    }

    const planEval = evaluation.metadata?.evaluation as
      | ExperimentTestPlanEvaluation
      | undefined;

    if (!planEval) {
      return renderErrorComment(context, evaluation);
    }

    return renderTestPlanComment(planEval, {context});
  }
}
