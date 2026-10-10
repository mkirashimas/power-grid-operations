'use client';

import { List, ListItemButton, ListItemText, Paper, Popper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { mentionAttrs, type AssetSuggestion } from '../editor/assetMention';
import { INCIDENTS_NAMESPACE } from '../i18n';

interface MentionListProps {
  suggestion: AssetSuggestion | null;
  active: number;
  listId: string;
  optionId: (index: number) => string;
}

/**
 * The asset list shown while typing `@`. Focus stays in the editor, which points at the
 * highlighted option with aria-activedescendant (see ReportEditor).
 */
export const MentionList = ({ suggestion, active, listId, optionId }: MentionListProps) => {
  const { t } = useTranslation(INCIDENTS_NAMESPACE);
  const rect = suggestion?.clientRect;
  // The decoration node lets the popper follow scrolling of the page and its containers.
  const anchor = rect
    ? {
        getBoundingClientRect: () => rect() ?? new DOMRect(),
        contextElement: suggestion?.decorationNode ?? undefined,
      }
    : null;

  return (
    <Popper
      open={Boolean(suggestion && anchor)}
      anchorEl={anchor}
      placement="bottom-start"
      sx={{ zIndex: 'modal' }}
    >
      <Paper elevation={8} sx={{ maxWidth: 360, maxHeight: 320, overflow: 'auto' }}>
        {suggestion && suggestion.items.length > 0 ? (
          <List dense id={listId} role="listbox" aria-label={t('editor.mentions')}>
            {suggestion.items.map((asset, index) => (
              <ListItemButton
                key={asset.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                selected={index === active}
                tabIndex={-1}
                // Keep focus (and the selection) in the editor.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => suggestion.command(mentionAttrs(asset))}
              >
                <ListItemText primary={asset.name} secondary={asset.id} />
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {t('editor.noMatches', { query: suggestion?.query ?? '' })}
          </Typography>
        )}
      </Paper>
    </Popper>
  );
};
