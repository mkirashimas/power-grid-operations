'use client';

import type { TelemetryStatus } from '@pgo/grid-model';
import { FilterField } from '@pgo/ui';
import { Box, Stack, Typography } from '@mui/material';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { TreeItem, type TreeItemProps } from '@mui/x-tree-view/TreeItem';
import { createContext, forwardRef, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NETWORK_NAMESPACE } from '../i18n';
import { filterTree, pathTo, type AssetTree as Tree, type TreeNode } from '../tree';

/** Live status per asset id, for the tree's status dots (a context keeps item props simple). */
const StatusContext = createContext<(id: string) => TelemetryStatus | undefined>(() => undefined);

const StatusItem = forwardRef<HTMLLIElement, TreeItemProps>(function StatusItem(props, ref) {
  const { t } = useTranslation(NETWORK_NAMESPACE);
  const status = useContext(StatusContext)(props.itemId);
  return (
    <TreeItem
      {...props}
      ref={ref}
      label={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          {status && (
            <Box
              aria-hidden
              sx={{
                width: 8,
                height: 8,
                flexShrink: 0,
                borderRadius: '50%',
                bgcolor: `status.${status}`,
              }}
            />
          )}
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {props.label}
          </Box>
          {/* Status in words too, so it never depends on colour alone. */}
          {status && status !== 'normal' && (
            <Typography component="span" variant="caption" sx={{ color: `status.${status}` }}>
              {t(`statuses.${status}`)}
            </Typography>
          )}
        </Stack>
      }
    />
  );
});

export interface AssetTreeProps {
  tree: Tree;
  statusOf: (id: string) => TelemetryStatus | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Zone → Substation → equipment, with live status. The tree keyboard pattern (arrows, Home,
 * End, type-ahead) makes it the keyboard path through the network. A selection made anywhere
 * expands the tree down to the selected asset.
 */
export const AssetTree = ({ tree, statusOf, selectedId, onSelect }: AssetTreeProps) => {
  const { t } = useTranslation(NETWORK_NAMESPACE);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const items = useMemo(() => filterTree(tree.items, query), [tree, query]);

  // Show a newly selected asset: expand its ancestors, keeping what the user opened. Adjusted
  // while rendering (React's pattern for state that follows a prop), not in an effect.
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (selectedId !== shownFor) {
    setShownFor(selectedId);
    if (selectedId) {
      setExpanded((current) => [...new Set([...current, ...pathTo(tree, selectedId)])]);
    }
  }

  // While filtering, open every zone and substation that matches.
  const visibleExpanded = useMemo(
    () =>
      query.trim()
        ? items.flatMap((zone) => [zone.id, ...(zone.children ?? []).map((node) => node.id)])
        : expanded,
    [query, items, expanded],
  );

  const label = (node: TreeNode) =>
    node.kind === 'zone' ? t(`zones.${node.label}`) : `${node.label}`;

  return (
    <Stack spacing={1}>
      <FilterField
        label={t('tree.filter')}
        placeholder={t('tree.filterPlaceholder')}
        clearLabel={t('tree.clear')}
        value={query}
        onChange={setQuery}
      />
      <Box
        sx={{
          height: 'min(64vh, 588px)',
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <StatusContext.Provider value={statusOf}>
          <RichTreeView
            aria-label={t('tree.label')}
            items={items}
            getItemId={(node) => node.id}
            getItemLabel={label}
            expandedItems={visibleExpanded}
            onExpandedItemsChange={(_, ids) => {
              if (!query.trim()) setExpanded(ids);
            }}
            selectedItems={selectedId}
            onSelectedItemsChange={(_, id) => {
              if (id && !id.startsWith('zone:')) onSelect(id);
            }}
            slots={{ item: StatusItem }}
          />
        </StatusContext.Provider>
        {items.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {t('tree.empty')}
          </Typography>
        )}
      </Box>
    </Stack>
  );
};
