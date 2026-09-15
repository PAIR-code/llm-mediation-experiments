import type {ExperimentTestPlanEvaluation} from './types.js';
import type {BotEvaluation, PRContext} from '../../core/types.js';

export interface RenderOptions {
  missingApiKey?: boolean;
  context?: PRContext;
}

/**
 * Generate a pre-populated GitHub issue URL for filing bug reports against the bot.
 */
export function buildBugReportUrl(
  context: PRContext | undefined,
  reason: string,
  details?: string,
): string {
  const owner = context?.owner || 'PAIR-code';
  const repo = context?.repo || 'deliberate-lab';
  const prTag = context?.prNumber ? ` on PR #${context.prNumber}` : '';
  const title = `bug(bots): Experiment Test Plan Assistant failure${prTag}`;

  const bodyLines = [
    '### Bot Failure Report',
    `- **PR**: #${context?.prNumber || 'unknown'} (${context?.title || 'unknown'})`,
    `- **Author**: @${context?.author || 'unknown'}`,
    `- **Head SHA**: \`${context?.headSha ? context.headSha.slice(0, 8) : 'unknown'}\``,
    `- **Reason**: ${reason}`,
    '',
  ];

  if (details) {
    bodyLines.push(
      '### Error Details',
      '```',
      details.slice(0, 1500),
      '```',
      '',
    );
  }

  bodyLines.push(
    '### Context',
    'Encountered persistent failure during Experiment Test Plan Assistant evaluation in GitHub Actions.',
  );

  const params = new URLSearchParams({
    title,
    body: bodyLines.join('\n'),
    labels: 'area:ci-deploy',
  });

  return `https://github.com/${owner}/${repo}/issues/new?${params.toString()}`;
}

/**
 * Render unexpected evaluation errors into a clean, actionable GitHub comment.
 */
export function renderErrorComment(
  context: PRContext,
  evaluation: BotEvaluation,
): string {
  const header = '### 🧪 Deliberate Lab • Experiment Test Plan Assistant\n\n';
  const bugUrl = buildBugReportUrl(
    context,
    evaluation.summary,
    evaluation.details,
  );

  return (
    header +
    `⚠️ **Evaluation Blocked: Upstream Service Error**\n\n` +
    `The assistant could not complete its evaluation because an upstream service error occurred:\n` +
    `> ${evaluation.summary}\n\n` +
    `*This check failed closed cleanly (blocking merge until resolved).* \n\n` +
    (evaluation.details
      ? `<details>\n<summary>Technical Error Details</summary>\n\n\`\`\`\n${evaluation.details.slice(0, 2000)}\n\`\`\`\n</details>\n\n`
      : '') +
    `---\n\n` +
    `#### 🔄 How to Re-run\n` +
    `- **Re-run Check**: In the PR's **Checks** tab, select **PR Review Bots** and click **Re-run all jobs**.\n` +
    `- **Trigger via Commit**: Push a new commit or close and reopen this PR to re-trigger once upstream services recover.\n` +
    `- **Persistent Failure**: If this issue persists across retries, please [file a bug report](${bugUrl}).`
  );
}

/**
 * Format an individual item within the 7-part experiment topology list.
 * Normalizes literal '\n' sequences into actual newlines and cleanly indents
 * nested sub-steps or bullet points (3 spaces) so GitHub Flavored Markdown
 * renders them as a proper nested list without breaking the outer list.
 */
export function formatTopologyItem(
  num: number,
  label: string,
  value?: string,
): string {
  if (!value) return `${num}. **${label}**: None / Not specified`;

  // Normalize literal '\n' escape sequences into real newlines
  const normalized = value.replace(/\\n/g, '\n').trim();

  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    const formattedLines = lines.map((line) => {
      // If already starts with a number like "1. " or "2) ", indent with 3 spaces
      if (/^\d+[.)]\s+/.test(line)) {
        return `   ${line}`;
      }
      // If starts with a bullet like "- " or "* ", indent with 3 spaces
      if (/^[-*]\s+/.test(line)) {
        return `   ${line}`;
      }
      // Otherwise, make it an indented bullet sub-item
      return `   - ${line}`;
    });

    return `${num}. **${label}**:\n${formattedLines.join('\n')}`;
  }

  // Check if a single line contains embedded inline numbered steps e.g. "1. ... 2. ..."
  const inlineNumbered = normalized.match(/^1[.)]\s+/);
  if (inlineNumbered && /\s+2[.)]\s+/.test(normalized)) {
    const subSteps = normalized
      .split(/(?=\b\d+[.)]\s+)/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (subSteps.length > 1) {
      const formattedLines = subSteps.map((step) => `   ${step}`);
      return `${num}. **${label}**:\n${formattedLines.join('\n')}`;
    }
  }

  return `${num}. **${label}**: ${normalized}`;
}

/**
 * Render ExperimentTestPlanEvaluation into GitHub-flavored Markdown.
 */
export function renderTestPlanComment(
  evaluation: ExperimentTestPlanEvaluation,
  options: RenderOptions = {},
): string {
  const header = '### 🧪 Deliberate Lab • Experiment Test Plan Assistant\n\n';

  if (options.missingApiKey) {
    const bugUrl = buildBugReportUrl(
      options.context,
      'Missing GEMINI_API_KEY secret in repository Actions secrets',
    );
    return (
      header +
      `⚠️ **Evaluation Blocked: Missing \`GEMINI_API_KEY\`**\n\n` +
      `The \`GEMINI_API_KEY\` secret is not configured in this environment. To enable automatic experiment test plan evaluation and tentative plan drafting, please configure the \`GEMINI_API_KEY\` secret in repository Actions secrets.\n\n` +
      `*This check failed closed cleanly (blocking merge until resolved).*\n\n` +
      `---\n\n` +
      `#### 🔄 How to Resolve\n` +
      `- **Maintainers**: Configure \`GEMINI_API_KEY\` in [Repository Settings > Secrets > Actions](https://github.com/PAIR-code/deliberate-lab/settings/secrets/actions).\n` +
      `- **Re-run Check**: Once the secret is configured, go to the PR's **Checks** tab and click **Re-run all jobs**.\n` +
      `- **Persistent Issues**: [File a bug report](${bugUrl})`
    );
  }

  // Non-runtime change scenario
  if (!evaluation.isRuntimeBehaviorChange) {
    return (
      header +
      `ℹ️ **Non-Runtime Change Detected**\n\n` +
      `${evaluation.classificationRationale}\n\n` +
      `*Manual experiment verification is not required for non-runtime pull requests (documentation, CI/CD workflows, developer tooling, or chores).*`
    );
  }

  // Runtime change with complete manual plan
  if (evaluation.hasManualTestPlan) {
    const details = evaluation.manualPlanDetails || {};
    const sanitizeTableCell = (text?: string) =>
      (text || 'Specified').replace(/\\n|\n/g, '<br>');

    return (
      header +
      `✅ **Manual Experiment Test Plan Verified**\n\n` +
      `This PR modifies runtime behavior and provides manual test verification steps covering Deliberate Lab's experiment topology:\n\n` +
      `| Topology Component | Verified Details |\n` +
      `| :--- | :--- |\n` +
      `| **Experiment Template** | ${sanitizeTableCell(details.experimentTemplate)} |\n` +
      `| **Stage Sequence** | ${sanitizeTableCell(details.stagesSequence)} |\n` +
      `| **Human Cohort** | ${sanitizeTableCell(details.humanParticipants)} |\n` +
      `| **Agent Mediator** | ${sanitizeTableCell(details.agentMediator)} |\n` +
      `| **Agent Participants** | ${sanitizeTableCell(details.agentParticipants)} |\n` +
      `| **Participant Actions** | ${sanitizeTableCell(details.participantActions)} |\n` +
      `| **Success Criteria** | ${sanitizeTableCell(details.successCriteria)} |\n\n` +
      `*Test plan verified. Reviewers can use these steps to evaluate the experiment.*`
    );
  }

  // Tier 4: Runtime change missing test plan, but confidently deduced by Gemini (CI Passes)
  const hasDeducedPlan =
    evaluation.canDeducePlan !== false &&
    Boolean(evaluation.suggestedTentativePlan);

  if (hasDeducedPlan && evaluation.suggestedTentativePlan) {
    const plan = evaluation.suggestedTentativePlan;
    const planItems = [
      formatTopologyItem(1, 'Experiment Template', plan.experimentTemplate),
      formatTopologyItem(2, 'Stages Sequence', plan.stagesSequence),
      formatTopologyItem(3, 'Human Cohort', plan.humanParticipants),
      formatTopologyItem(4, 'Agent Mediator', plan.agentMediator),
      formatTopologyItem(5, 'Agent Participants', plan.agentParticipants),
      formatTopologyItem(6, 'Tester Actions', plan.participantActions),
      formatTopologyItem(7, 'Expected Behavior', plan.successCriteria),
    ].join('\n');

    return (
      header +
      `💡 **Draft Manual Experiment Test Plan (Ready for Review)**\n\n` +
      `This pull request alters runtime application behavior. While manual verification steps were not provided in the PR description, a tentative 7-step test plan was synthesized from the code changes:\n\n` +
      `**Classification Rationale**: ${evaluation.classificationRationale}\n\n` +
      `#### 📋 Suggested Test Plan\n` +
      `${planItems}\n\n` +
      `---\n\n` +
      `*✅ **CI Status: Passed** — Reviewers and maintainers can use this draft test plan to verify the PR locally. Authors are encouraged to adopt or refine these steps in their PR description.*`
    );
  }

  // Tier 5: Runtime change missing test plan, and cannot be deduced (CI Fails Closed)
  const bugUrl = buildBugReportUrl(
    options.context,
    'Potential misclassification or test plan synthesis failure',
    `Rationale: ${evaluation.classificationRationale}\nMissing: ${evaluation.missingElements.join(', ')}\nGuidance Needed: ${evaluation.guidanceNeededReason || 'Opaque diff'}`,
  );

  return (
    header +
    `⚠️ **Manual Experiment Test Plan Guidance Required**\n\n` +
    `This pull request alters runtime application behavior, but complete manual verification steps were not provided and could not be confidently deduced from the code changes.\n\n` +
    `**Classification Rationale**: ${evaluation.classificationRationale}\n\n` +
    `**Why Author Guidance Is Needed**:\n` +
    `${evaluation.guidanceNeededReason || 'The changes to runtime behavior are too complex or opaque to deduce a realistic 7-step test plan automatically.'}\n\n` +
    (evaluation.missingElements.length > 0
      ? `**Missing Topology Elements**: ${evaluation.missingElements.join(', ')}\n\n`
      : '') +
    `---\n\n` +
    `#### 🔄 How to Resolve\n` +
    `1. Update your PR description to include step-by-step manual test instructions addressing the 7-part experiment topology (Template, Stages, Human Cohort, Agent Mediator, Agent Participants, Actions, Expected Behavior).\n` +
    `2. Re-run this check by clicking **Re-run all jobs** under the **Checks** tab (or push an update to your PR).\n` +
    `3. If you believe this PR was misclassified or if this check is failing persistently, please [file a bug report](${bugUrl}).\n\n` +
    `*❌ **CI Status: Blocked** — Manual experiment verification instructions are required from the author before this PR can be merged.*`
  );
}
