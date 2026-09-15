import process from 'node:process';
import type {PRReviewBot} from './types.js';
import {loadPRContext} from './pr-context.js';
import {postOrUpdateComment} from './comment-manager.js';

export interface CliArgs {
  prNumber?: number;
  owner?: string;
  repo?: string;
  dryRun: boolean;
}

export function parseArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {dryRun: false};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--pr' && args[i + 1]) {
      parsed.prNumber = parseInt(args[++i], 10);
    } else if (arg === '--owner' && args[i + 1]) {
      parsed.owner = args[++i];
    } else if (arg === '--repo' && args[i + 1]) {
      parsed.repo = args[++i];
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    }
  }

  return parsed;
}

/**
 * Execute a single review bot against a pull request.
 */
export async function runBot(
  bot: PRReviewBot,
  argv: string[] = process.argv.slice(2),
): Promise<void> {
  const args = parseArgs(argv);

  console.log(`🤖 Deliberate Lab PR Review Bot: ${bot.name} (id: ${bot.id})`);
  console.log('----------------------------------------');

  const context = await loadPRContext({
    owner: args.owner,
    repo: args.repo,
    prNumber: args.prNumber,
  });

  console.log(`Repository: ${context.owner}/${context.repo}`);
  console.log(`Pull Request: #${context.prNumber} ("${context.title}")`);
  console.log(`Author: @${context.author}`);
  console.log(`Head SHA: ${context.headSha}`);
  console.log(`Files Changed: ${context.files.length}`);
  console.log('----------------------------------------');

  if (!bot.shouldRun(context)) {
    console.log(`  [SKIP] Bot indicated shouldRun = false (e.g. draft PR).`);
    return;
  }

  console.log('  Evaluating PR...');
  const evaluation = await bot.evaluate(context);
  console.log(
    `  Evaluation result: [${evaluation.status.toUpperCase()}] ${evaluation.summary}`,
  );

  const commentBody = bot.renderComment(context, evaluation);
  const result = await postOrUpdateComment(context, {
    botId: bot.id,
    markdownBody: commentBody,
    dryRun: args.dryRun,
  });

  if (result.action === 'skipped_dry_run') {
    console.log('  [DRY RUN] Completed without updating GitHub.');
  } else {
    console.log(
      `  [OK] Comment ${result.action}: ${result.url || result.commentId}`,
    );
  }

  if (evaluation.status === 'warn' || evaluation.status === 'fail') {
    console.error(
      `\n❌ Blocking check failure: ${bot.name} reported requirements not met (see comment above).`,
    );
    process.exit(1);
  }

  console.log(`\n✅ ${bot.name} evaluation passed.`);
}
