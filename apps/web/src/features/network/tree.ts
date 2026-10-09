import { WEATHER_ZONES, type Asset, type AssetKind, type WeatherZone } from '@pgo/grid-model';

export interface TreeNode {
  /** Asset id, or `zone:<zone>` for a zone. */
  id: string;
  /** Asset name, or the zone key (translated when rendered). */
  label: string;
  kind: AssetKind | 'zone';
  children?: TreeNode[];
}

export interface AssetTree {
  items: TreeNode[];
  /** Parent id of every node below a zone. */
  parentOf: Map<string, string>;
}

export const zoneNodeId = (zone: WeatherZone) => `zone:${zone}`;

const CHILD_ORDER: Record<AssetKind, number> = { generator: 0, load: 1, line: 2, substation: 3 };
const byName = (a: Asset, b: Asset) => a.name.localeCompare(b.name);

/**
 * Zone → Substation → its generators, load and lines. A line is listed under its sending
 * substation, so every asset appears exactly once.
 */
export const buildTree = (assets: readonly Asset[]): AssetTree => {
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, Asset[]>();
  assets.forEach((asset) => {
    if (asset.kind === 'substation' || !asset.substationId) return;
    childrenOf.set(asset.substationId, [...(childrenOf.get(asset.substationId) ?? []), asset]);
  });

  const items = WEATHER_ZONES.map((zone): TreeNode => {
    const zoneId = zoneNodeId(zone);
    const substations = assets
      .filter((asset) => asset.kind === 'substation' && asset.zone === zone)
      .sort(byName);
    return {
      id: zoneId,
      label: zone,
      kind: 'zone',
      children: substations.map((substation) => {
        parentOf.set(substation.id, zoneId);
        const children = [...(childrenOf.get(substation.id) ?? [])].sort(
          (a, b) => CHILD_ORDER[a.kind] - CHILD_ORDER[b.kind] || byName(a, b),
        );
        children.forEach((child) => parentOf.set(child.id, substation.id));
        return {
          id: substation.id,
          label: substation.name,
          kind: 'substation',
          children: children.map((child) => ({
            id: child.id,
            label: child.name,
            kind: child.kind,
          })),
        };
      }),
    };
  });
  return { items, parentOf };
};

/** Ids to expand so `id` is visible: its ancestors, top first. */
export const pathTo = (tree: AssetTree, id: string): string[] => {
  const path: string[] = [];
  let parent = tree.parentOf.get(id);
  while (parent) {
    path.unshift(parent);
    parent = tree.parentOf.get(parent);
  }
  return path;
};

/**
 * Keeps substations whose name, or any child's name, contains `query` (case-insensitive), and
 * the zones that still have substations. An empty query keeps everything.
 */
export const filterTree = (items: readonly TreeNode[], query: string): TreeNode[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  const matches = (node: TreeNode) => node.label.toLowerCase().includes(needle);
  return items
    .map((zone) => ({
      ...zone,
      children: zone.children?.filter(
        (substation) => matches(substation) || substation.children?.some(matches),
      ),
    }))
    .filter((zone) => zone.children?.length);
};
