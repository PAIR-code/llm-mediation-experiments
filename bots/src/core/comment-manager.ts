import * as github from '@actions/github';
import type {PRContext} from './types.js';
import {resolveGitHubToken} from './pr-context.js';

export interface CommentOptions {
  botId: string;
  markdownBody: string;
  dryRun?: boolean;
  token?: string;
}

export interface CommentResult {
  action: 'created' | 'updated' | 'skipped_dry_run';
  commentId?: number;
  url?: string;
}

/**
 * Generate standard HTML signature marker for a specialist bot.
 * Follows the convention: `<!-- deliberate-lab-bot: <bot-id> -->` (e.g. `experiment-test-plan`).
 */
export function getBotMarker(botId: string): string {
  return `<!-- deliberate-lab-bot: ${botId} -->`;
}

/**
 * Idempotently post or update a PR comment for a given bot.
 */
export async function postOrUpdateComment(
  context: PRContext,
  options: CommentOptions,
): Promise<CommentResult> {
  const marker = getBotMarker(options.botId);
  const fullBody = `${options.markdownBody.trim()}\n\n${marker}`;

  if (options.dryRun) {
    console.log(
      `[DRY RUN] Would post or update comment for bot "${options.botId}":\n`,
    );
    console.log(fullBody);
    return {action: 'skipped_dry_run'};
  }

  const token = resolveGitHubToken(options.token);
  const octokit = github.getOctokit(token);

  try {
    // List existing comments to find an existing one with this bot's marker
    const {data: comments} = await octokit.rest.issues.listComments({
      owner: context.owner,
      repo: context.repo,
      issue_number: context.prNumber,
      per_page: 100,
    });

    const existingComment = comments.find((comment) =>
      comment.body?.includes(marker),
    );

    if (existingComment) {
      const {data: updated} = await octokit.rest.issues.updateComment({
        owner: context.owner,
        repo: context.repo,
        comment_id: existingComment.id,
        body: fullBody,
      });
      return {
        action: 'updated',
        commentId: updated.id,
        url: updated.html_url,
      };
    }

    const {data: created} = await octokit.rest.issues.createComment({
      owner: context.owner,
      repo: context.repo,
      issue_number: context.prNumber,
      body: fullBody,
    });

    return {
      action: 'created',
      commentId: created.id,
      url: created.html_url,
    };
  } catch (error: unknown) {
    const err = error as {status?: number; message?: string};
    if (err.status === 403) {
      console.warn(
        `\n[WARN] GITHUB_TOKEN has read-only access (status 403 Forbidden).`,
      );
      console.warn(
        `       This occurs when running under 'pull_request' on an unmerged fork PR.`,
      );
      console.warn(
        `       Once merged to main, 'pull_request_target' will have full write permissions.\n`,
      );
      console.log(`[PREVIEW] Comment that would have been posted:\n`);
      console.log(fullBody);
      return {action: 'skipped_dry_run'};
    }
    throw error;
  }
}
