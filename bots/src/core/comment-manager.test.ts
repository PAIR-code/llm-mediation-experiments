import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {getBotMarker} from './comment-manager.js';

describe('comment-manager', () => {
  it('generates expected HTML marker tag for a bot ID', () => {
    const marker = getBotMarker('experiment-test-plan');
    assert.equal(marker, '<!-- deliberate-lab-bot: experiment-test-plan -->');
  });

  it('generates unique marker for different bot IDs', () => {
    const markerA = getBotMarker('bot-a');
    const markerB = getBotMarker('bot-b');
    assert.notEqual(markerA, markerB);
    assert.equal(markerA, '<!-- deliberate-lab-bot: bot-a -->');
  });
});
