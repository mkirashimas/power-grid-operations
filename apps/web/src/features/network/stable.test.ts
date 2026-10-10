import { describe, expect, it } from 'vitest';
import { reuseUnchanged } from './stable';

interface Item {
  id: string;
  colour: string;
}

const same = (a: Item, b: Item) => a.colour === b.colour;

describe('reuseUnchanged', () => {
  it('keeps the previous object for unchanged items and takes the new one for changed items', () => {
    const cache = new Map<string, Item>();
    const first = reuseUnchanged(
      cache,
      [
        { id: 'a', colour: 'green' },
        { id: 'b', colour: 'green' },
      ],
      same,
    );
    const second = reuseUnchanged(
      cache,
      [
        { id: 'a', colour: 'green' },
        { id: 'b', colour: 'red' },
      ],
      same,
    );
    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[1].colour).toBe('red');
  });

  it('forgets items that are gone', () => {
    const cache = new Map<string, Item>();
    reuseUnchanged(cache, [{ id: 'a', colour: 'green' }], same);
    reuseUnchanged(cache, [{ id: 'b', colour: 'green' }], same);
    expect([...cache.keys()]).toEqual(['b']);
  });
});
