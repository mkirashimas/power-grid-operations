import { generateAssets } from '@pgo/grid-model';
import { describe, expect, it } from 'vitest';
import { buildTree, filterTree, pathTo, zoneNodeId } from './tree';

describe('buildTree', () => {
  const assets = generateAssets();
  const tree = buildTree(assets);
  const all = tree.items.flatMap((zone) => [
    zone,
    ...(zone.children ?? []).flatMap((substation) => [substation, ...(substation.children ?? [])]),
  ]);

  it('has the 8 zones, then substations, then their equipment, every asset once', () => {
    expect(tree.items).toHaveLength(8);
    const assetNodes = all.filter((node) => node.kind !== 'zone');
    expect(assetNodes).toHaveLength(assets.length);
    expect(new Set(assetNodes.map((node) => node.id)).size).toBe(assets.length);
  });

  it('lists generators, then the load, then lines under each substation', () => {
    const order = { generator: 0, load: 1, line: 2 } as Record<string, number>;
    tree.items[0].children!.forEach((substation) => {
      const kinds = substation.children!.map((child) => order[child.kind]);
      expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
    });
  });

  it('finds the path to any asset', () => {
    const line = assets.find((asset) => asset.kind === 'line')!;
    const substation = assets.find((asset) => asset.id === line.substationId)!;
    expect(pathTo(tree, line.id)).toEqual([zoneNodeId(substation.zone), substation.id]);
    expect(pathTo(tree, substation.id)).toEqual([zoneNodeId(substation.zone)]);
    expect(pathTo(tree, zoneNodeId('coast'))).toEqual([]);
  });

  it('filters by substation or equipment name, dropping empty zones', () => {
    const substation = tree.items[2].children![0];
    const filtered = filterTree(tree.items, substation.label.toUpperCase());
    expect(filtered.flatMap((zone) => zone.children!.map((s) => s.id))).toContain(substation.id);
    expect(filtered.every((zone) => zone.children!.length > 0)).toBe(true);
    expect(filterTree(tree.items, 'no such asset')).toEqual([]);
    expect(filterTree(tree.items, '  ')).toHaveLength(8);
  });
});
