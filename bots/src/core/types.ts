/**
 * Core types and interfaces for Deliberate Lab PR review bots.
 */

export interface PRFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface PRContext {
  owner: string;
  repo: string;
  prNumber: number;
  title: string;
  body: string;
  author: string;
  baseRef: string;
  headRef: string;
  headSha: string;
  isDraft: boolean;
  labels: string[];
  files: PRFile[];
}

export interface BotEvaluation {
  status: 'pass' | 'warn' | 'fail' | 'info';
  summary: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

export interface PRReviewBot {
  /**
   * Unique identifier for the specialist bot, used in HTML comment signatures:
   * `<!-- deliberate-lab-bot: <id> -->` (e.g. `experiment-test-plan`).
   */
  readonly id: string;

  /**
   * Human-readable display name used in titles/logs.
   */
  readonly name: string;

  /**
   * Pre-filter check to decide if this bot should run on the given PR.
   */
  shouldRun(context: PRContext): boolean;

  /**
   * Perform evaluation and return structured results.
   */
  evaluate(context: PRContext): Promise<BotEvaluation>;

  /**
   * Render the evaluation into a GitHub Markdown comment body.
   */
  renderComment(context: PRContext, evaluation: BotEvaluation): string;
}
