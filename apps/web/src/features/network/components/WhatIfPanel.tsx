'use client';

import type { Asset } from '@pgo/grid-model';
import { IconButton } from '@pgo/ui';
import UndoOutlined from '@mui/icons-material/UndoOutlined';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findAsset } from '../../../store/assets';
import type { StudyEdit } from '../engine/study';
import { NETWORK_NAMESPACE } from '../i18n';

export interface WhatIfPanelProps {
  selected: Asset | undefined;
  edits: readonly StudyEdit[];
  onApply: (edit: StudyEdit) => void;
  onRemove: (edit: StudyEdit) => void;
  onReset: () => void;
}

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

/** Load change for a substation, applied when the slider is released. */
const LoadSlider = ({
  substation,
  percent,
  onCommit,
}: {
  substation: Asset;
  percent: number;
  onCommit: (percent: number) => void;
}) => {
  const { t } = useTranslation(NETWORK_NAMESPACE);
  const labelId = useId();
  const [value, setValue] = useState(percent);
  return (
    <Box>
      <Typography id={labelId} variant="body2">
        {t('editor.load', { name: substation.name })}
      </Typography>
      <Slider
        aria-labelledby={labelId}
        value={value}
        min={-50}
        max={50}
        step={10}
        marks
        valueLabelDisplay="auto"
        getAriaValueText={(v) => t('editor.loadValue', { value: signed(v) })}
        valueLabelFormat={(v) => t('editor.loadValue', { value: signed(v) })}
        onChange={(_, next) => setValue(next as number)}
        onChangeCommitted={(_, next) => onCommit(next as number)}
      />
    </Box>
  );
};

/** Change the selected asset in the study, and list (or undo) every change made so far. */
export const WhatIfPanel = ({ selected, edits, onApply, onRemove, onReset }: WhatIfPanelProps) => {
  const { t } = useTranslation(NETWORK_NAMESPACE);
  const has = (type: StudyEdit['type'], assetId: string) =>
    edits.some((edit) => edit.type === type && edit.assetId === assetId);
  const describe = (edit: StudyEdit) => {
    const name = findAsset(edit.assetId)?.name ?? edit.assetId;
    return edit.type === 'load'
      ? t('edits.load', { name, value: signed(edit.percent) })
      : t(`edits.${edit.type}`, { name });
  };

  // A load is changed through its substation.
  const substation =
    selected?.kind === 'substation'
      ? selected
      : selected?.kind === 'load'
        ? findAsset(selected.substationId ?? null)
        : undefined;
  const loadEdit = substation
    ? edits.find((edit) => edit.type === 'load' && edit.assetId === substation.id)
    : undefined;

  return (
    <Stack spacing={2} data-testid="what-if-panel">
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
          {selected ? selected.name : t('editor.title')}
        </Typography>
        {!selected && (
          <Typography variant="body2" color="text.secondary">
            {t('editor.empty')}
          </Typography>
        )}
        {selected?.kind === 'line' &&
          (has('trip', selected.id) ? (
            <Button
              variant="outlined"
              onClick={() => onRemove({ type: 'trip', assetId: selected.id })}
            >
              {t('editor.restore')}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={() => onApply({ type: 'trip', assetId: selected.id })}
            >
              {t('editor.trip')}
            </Button>
          ))}
        {selected?.kind === 'generator' &&
          (has('offline', selected.id) ? (
            <Button
              variant="outlined"
              onClick={() => onRemove({ type: 'offline', assetId: selected.id })}
            >
              {t('editor.online')}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={() => onApply({ type: 'offline', assetId: selected.id })}
            >
              {t('editor.offline')}
            </Button>
          ))}
        {substation && (
          <LoadSlider
            // A new substation or an undo starts the slider from the stored value.
            key={`${substation.id}:${loadEdit?.type === 'load' ? loadEdit.percent : 0}`}
            substation={substation}
            percent={loadEdit?.type === 'load' ? loadEdit.percent : 0}
            onCommit={(percent) => onApply({ type: 'load', assetId: substation.id, percent })}
          />
        )}
      </Box>

      <Box>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" component="h3">
            {t('editor.edits')}
          </Typography>
          <Button size="small" onClick={onReset} disabled={edits.length === 0}>
            {t('editor.reset')}
          </Button>
        </Stack>
        {edits.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('editor.noEdits')}
          </Typography>
        ) : (
          <List dense disablePadding aria-label={t('editor.edits')}>
            {edits.map((edit) => (
              <ListItem
                key={`${edit.type}:${edit.assetId}`}
                disableGutters
                secondaryAction={
                  <IconButton
                    label={t('editor.undo', { edit: describe(edit) })}
                    onClick={() => onRemove(edit)}
                    size="small"
                  >
                    <UndoOutlined fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText primary={describe(edit)} />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Stack>
  );
};
