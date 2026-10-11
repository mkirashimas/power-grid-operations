'use client';

import HelpOutlined from '@mui/icons-material/HelpOutlined';
import { IconButton } from '@pgo/ui';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store';
import { closeHelp, openHelp, selectHelpOpen } from '../store/shellSlice';

/** Id of the help panel rendered by hoc/Layout. */
export const HELP_PANEL_ID = 'section-help';

/** Opens and closes the section help panel. Goes in each page's PageHeader `action`. */
export const HelpButton = () => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectHelpOpen);

  return (
    <IconButton
      label={t('help.open')}
      aria-expanded={open}
      aria-controls={open ? HELP_PANEL_ID : undefined}
      onClick={() => dispatch(open ? closeHelp() : openHelp())}
    >
      <HelpOutlined />
    </IconButton>
  );
};
