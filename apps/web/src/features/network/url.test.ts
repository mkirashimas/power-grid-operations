import { describe, expect, it } from 'vitest';
import type { StudyEdit } from './engine/study';
import { DEFAULT_NETWORK_STATE } from './slice';
import { decodeEdits, encodeEdits, fromSearchParams, toSearchParams } from './url';

const edits: StudyEdit[] = [
  { type: 'trip', assetId: 'ln-0012' },
  { type: 'load', assetId: 'sub-cst-001', percent: -20 },
  { type: 'offline', assetId: 'gen-cst-003' },
];

describe('network URL state', () => {
  it('encodes edits compactly and decodes them back', () => {
    const encoded = encodeEdits(edits);
    expect(encoded).toBe('t.ln-0012~l.sub-cst-001.-20~o.gen-cst-003');
    expect(decodeEdits(encoded)).toEqual(edits);
  });

  it('round-trips the whole view and leaves out defaults', () => {
    expect(toSearchParams(DEFAULT_NETWORK_STATE).toString()).toBe('');
    const state = { mode: 'study', zone: 'coast', edits } as const;
    expect(fromSearchParams(toSearchParams(state))).toEqual(state);
  });

  it('drops malformed edits, clamps load changes and ignores unknown values', () => {
    expect(decodeEdits('t.ln-0001~x.ln-0002~t.~l.sub-a.999~l.sub-b.0~t.../etc')).toEqual([
      { type: 'trip', assetId: 'ln-0001' },
      { type: 'load', assetId: 'sub-a', percent: 50 },
    ]);
    expect(fromSearchParams(new URLSearchParams('mode=chaos&zone=mars'))).toEqual(
      DEFAULT_NETWORK_STATE,
    );
  });
});
