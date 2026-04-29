/**
 * @license
 * Copyright 2025 Google LLC
 * Copyright 2025 sluisr (DeepSeek adaptation)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { DeepSeekContentGenerator } from './deepseekContentGenerator.js';

// Access private members via a typed cast for test purposes.
type WithPrivate = {
  getMessageKey: (text: string, tool_calls?: unknown[]) => string;
};

function asPrivate(g: DeepSeekContentGenerator): WithPrivate {
  return g as unknown as WithPrivate;
}

describe('DeepSeekContentGenerator.getMessageKey', () => {
  const gen = new DeepSeekContentGenerator('test-key');

  it('produces identical keys for `undefined` and `[]` tool_calls', () => {
    const text = 'Voy a presentarte las opciones';
    const keyUndefined = asPrivate(gen).getMessageKey(text, undefined);
    const keyEmpty = asPrivate(gen).getMessageKey(text, []);
    // This regression matters: the streaming save path uses `undefined`
    // when the assistant has no tool calls, while the load path
    // (`mapGoogleToDeepSeek`) builds an empty array via `fnCallParts.map(...)`.
    // A mismatch causes cache misses, which drop `reasoning_content` and
    // trigger DeepSeek 400 errors in tool-using conversations.
    expect(keyUndefined).toBe(keyEmpty);
  });

  it('normalizes whitespace in text', () => {
    const a = asPrivate(gen).getMessageKey('  hello\n  world  ');
    const b = asPrivate(gen).getMessageKey('hello world');
    expect(a).toBe(b);
  });

  it('produces a different key when tool_calls are present', () => {
    const empty = asPrivate(gen).getMessageKey('hi', []);
    const withCall = asPrivate(gen).getMessageKey('hi', [
      { name: 'list_directory', args: { path: '/tmp' } },
    ]);
    expect(empty).not.toBe(withCall);
  });

  it('orders tool_calls by name for stable signatures', () => {
    const a = asPrivate(gen).getMessageKey('', [
      { name: 'b_tool', args: {} },
      { name: 'a_tool', args: {} },
    ]);
    const b = asPrivate(gen).getMessageKey('', [
      { name: 'a_tool', args: {} },
      { name: 'b_tool', args: {} },
    ]);
    expect(a).toBe(b);
  });
});
