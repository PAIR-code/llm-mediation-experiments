import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {HelloWorldBot} from './bot.js';
import type {PRContext} from '../../core/types.js';

const mockContext: PRContext = {
  owner: 'PAIR-code',
  repo: 'deliberate-lab',
  prNumber: 42,
  title: 'feat: add awesome feature',
  body: 'This PR adds something great.',
  author: 'test-author',
  baseRef: 'main',
  headRef: 'feat-branch',
  headSha: 'abc1234567890',
  isDraft: false,
  labels: ['feature'],
  files: [
    {
      filename: 'utils/src/test.ts',
      status: 'modified',
      additions: 10,
      deletions: 2,
      changes: 12,
    },
  ],
};

describe('HelloWorldBot', () => {
  const bot = new HelloWorldBot();

  it('should have correct id and name', () => {
    assert.equal(bot.id, 'hello-world');
    assert.match(bot.name, /Status Check/);
  });

  it('shouldRun always returns true for hello-world', () => {
    assert.equal(bot.shouldRun(mockContext), true);
  });

  it('evaluates context and returns pass status', async () => {
    const evaluation = await bot.evaluate(mockContext);
    assert.equal(evaluation.status, 'pass');
    assert.match(evaluation.summary, /verified/i);
    assert.equal(evaluation.metadata?.fileCount, 1);
  });

  it('renders markdown comment with PR details and table', async () => {
    const evaluation = await bot.evaluate(mockContext);
    const comment = bot.renderComment(mockContext, evaluation);

    assert.match(comment, /#42/);
    assert.match(comment, /test-author/);
    assert.match(comment, /abc12345/);
    assert.match(comment, /Operational/);
  });
});
