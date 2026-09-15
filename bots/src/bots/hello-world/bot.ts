import type {BotEvaluation, PRContext, PRReviewBot} from '../../core/types.js';

export class HelloWorldBot implements PRReviewBot {
  readonly id = 'hello-world';
  readonly name = 'Deliberate Lab Diagnostics • Pipeline Status Check';

  shouldRun(_context: PRContext): boolean {
    return true;
  }

  async evaluate(context: PRContext): Promise<BotEvaluation> {
    return {
      status: 'pass',
      summary: 'Hello World! PR review bot pipeline verified.',
      details: `Inspected ${context.files.length} files on branch ${context.headRef} at commit ${context.headSha.slice(0, 8)}.`,
      metadata: {
        fileCount: context.files.length,
        headSha: context.headSha,
      },
    };
  }

  renderComment(context: PRContext, evaluation: BotEvaluation): string {
    const totalAdditions = context.files.reduce(
      (sum, f) => sum + f.additions,
      0,
    );
    const totalDeletions = context.files.reduce(
      (sum, f) => sum + f.deletions,
      0,
    );
    const timestamp = new Date().toISOString();

    return `### 🤖 Deliberate Lab Diagnostics • Pipeline Verified

${evaluation.summary}

| Metric | Details |
| :--- | :--- |
| **Pull Request** | #${context.prNumber} (${context.title}) |
| **Author** | @${context.author} |
| **Head Commit** | \`${context.headSha.slice(0, 8)}\` |
| **Changes** | ${context.files.length} file(s) (+\`${totalAdditions}\` / -\`${totalDeletions}\`) |
| **Status** | ✅ Operational |
| **Last Evaluated** | \`${timestamp}\` |

*This is a deterministic Phase 1 health check verifying GitHub Actions triggers, Octokit API authentication, and idempotent comment updates.*`;
  }
}
