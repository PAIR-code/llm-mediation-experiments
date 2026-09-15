import {execSync} from 'node:child_process';
import * as github from '@actions/github';
import type {PRContext, PRFile} from './types.js';

export interface ContextOptions {
  owner?: string;
  repo?: string;
  prNumber?: number;
  token?: string;
}

/**
 * Resolve a GitHub token from environment variables or local `gh auth token`.
 */
export function resolveGitHubToken(explicitToken?: string): string {
  if (explicitToken) return explicitToken;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;

  // Attempt to read from gh CLI for local development
  try {
    const token = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (token) return token;
  } catch {
    // gh CLI not available or not logged in
  }

  throw new Error(
    'GitHub token not found. Please provide GITHUB_TOKEN or ensure `gh auth login` is configured.',
  );
}

/**
 * Fetch and construct the PRContext for a given pull request.
 */
export async function loadPRContext(
  options: ContextOptions = {},
): Promise<PRContext> {
  const token = resolveGitHubToken(options.token);
  const octokit = github.getOctokit(token);

  let owner = options.owner;
  let repo = options.repo;
  let prNumber = options.prNumber;

  // If in GitHub Actions, infer from action context
  if (!owner || !repo) {
    if (process.env.GITHUB_REPOSITORY) {
      const [envOwner, envRepo] = process.env.GITHUB_REPOSITORY.split('/');
      owner = owner || envOwner;
      repo = repo || envRepo;
    } else {
      try {
        if (github.context.repo.owner && github.context.repo.repo) {
          owner = owner || github.context.repo.owner;
          repo = repo || github.context.repo.repo;
        }
      } catch {
        // Not running in an Actions environment with GITHUB_REPOSITORY set
      }
    }
    owner = owner || 'PAIR-code';
    repo = repo || 'deliberate-lab';
  }

  if (!prNumber) {
    if (github.context.payload.pull_request?.number) {
      prNumber = github.context.payload.pull_request.number;
    } else if (github.context.issue?.number) {
      prNumber = github.context.issue.number;
    }
  }

  if (!owner || !repo || !prNumber) {
    throw new Error(
      `Unable to resolve PR context (owner: ${owner}, repo: ${repo}, prNumber: ${prNumber}). ` +
        'Specify --owner, --repo, and --pr when running locally.',
    );
  }

  // Fetch PR metadata
  const {data: pr} = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  // Fetch PR changed files (pages up to 300 files)
  const files: PRFile[] = [];
  let page = 1;
  const perPage = 100;

  while (page <= 3) {
    const {data: pageFiles} = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: perPage,
      page,
    });

    for (const f of pageFiles) {
      files.push({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch,
      });
    }

    if (pageFiles.length < perPage) break;
    page++;
  }

  const labels = (pr.labels || [])
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter((name): name is string => Boolean(name));

  return {
    owner,
    repo,
    prNumber,
    title: pr.title,
    body: pr.body || '',
    author: pr.user?.login || 'unknown',
    baseRef: pr.base.ref,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    isDraft: Boolean(pr.draft),
    labels,
    files,
  };
}
