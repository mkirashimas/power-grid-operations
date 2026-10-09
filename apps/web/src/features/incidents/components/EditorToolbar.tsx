'use client';

import ChecklistOutlined from '@mui/icons-material/ChecklistOutlined';
import FormatBoldOutlined from '@mui/icons-material/FormatBoldOutlined';
import FormatItalicOutlined from '@mui/icons-material/FormatItalicOutlined';
import FormatListBulletedOutlined from '@mui/icons-material/FormatListBulletedOutlined';
import FormatListNumberedOutlined from '@mui/icons-material/FormatListNumberedOutlined';
import LinkOutlined from '@mui/icons-material/LinkOutlined';
import RedoOutlined from '@mui/icons-material/RedoOutlined';
import TitleOutlined from '@mui/icons-material/TitleOutlined';
import UndoOutlined from '@mui/icons-material/UndoOutlined';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  ToggleButton,
  Tooltip,
} from '@mui/material';
import { IconButton, Toolbar } from '@pgo/ui';
import { useEditorState, type Editor } from '@tiptap/react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isSafeLink } from '../editor/links';
import { INCIDENTS_NAMESPACE } from '../i18n';

interface FormatToggleProps {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** A formatting toggle: its label is the accessible name and the tooltip; aria-pressed shows its state. */
const FormatToggle = ({ label, pressed, onToggle, children }: FormatToggleProps) => (
  <Tooltip title={label}>
    <ToggleButton
      value={label}
      size="small"
      aria-label={label}
      selected={pressed}
      // Keep the editor's selection while clicking.
      onMouseDown={(event) => event.preventDefault()}
      onChange={onToggle}
      sx={{ border: 0 }}
    >
      {children}
    </ToggleButton>
  </Tooltip>
);

/** Formatting controls for the report editor. */
export const EditorToolbar = ({ editor }: { editor: Editor }) => {
  const { t } = useTranslation(INCIDENTS_NAMESPACE);
  const titleId = useId();
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('');
  const [invalid, setInvalid] = useState(false);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      heading: current.isActive('heading', { level: 2 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      taskList: current.isActive('taskList'),
      link: current.isActive('link'),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  const openLink = () => {
    setHref((editor.getAttributes('link').href as string | undefined) ?? '');
    setInvalid(false);
    setLinkOpen(true);
  };
  const closeLink = () => {
    setLinkOpen(false);
    editor.commands.focus();
  };
  const applyLink = () => {
    const value = href.trim();
    if (!isSafeLink(value)) {
      setInvalid(true);
      return;
    }
    chain().extendMarkRange('link').setLink({ href: value }).run();
    setLinkOpen(false);
  };
  const removeLink = () => {
    chain().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <>
      <Toolbar label={t('editor.toolbar')}>
        <FormatToggle
          label={t('editor.heading2')}
          pressed={state.heading}
          onToggle={() => chain().toggleHeading({ level: 2 }).run()}
        >
          <TitleOutlined fontSize="small" />
        </FormatToggle>
        <FormatToggle
          label={t('editor.bold')}
          pressed={state.bold}
          onToggle={() => chain().toggleBold().run()}
        >
          <FormatBoldOutlined fontSize="small" />
        </FormatToggle>
        <FormatToggle
          label={t('editor.italic')}
          pressed={state.italic}
          onToggle={() => chain().toggleItalic().run()}
        >
          <FormatItalicOutlined fontSize="small" />
        </FormatToggle>
        <Divider orientation="vertical" flexItem />
        <FormatToggle
          label={t('editor.bulletList')}
          pressed={state.bulletList}
          onToggle={() => chain().toggleBulletList().run()}
        >
          <FormatListBulletedOutlined fontSize="small" />
        </FormatToggle>
        <FormatToggle
          label={t('editor.orderedList')}
          pressed={state.orderedList}
          onToggle={() => chain().toggleOrderedList().run()}
        >
          <FormatListNumberedOutlined fontSize="small" />
        </FormatToggle>
        <FormatToggle
          label={t('editor.taskList')}
          pressed={state.taskList}
          onToggle={() => chain().toggleTaskList().run()}
        >
          <ChecklistOutlined fontSize="small" />
        </FormatToggle>
        <FormatToggle label={t('editor.link')} pressed={state.link} onToggle={openLink}>
          <LinkOutlined fontSize="small" />
        </FormatToggle>
        <Divider orientation="vertical" flexItem />
        <IconButton
          label={t('editor.undo')}
          size="small"
          disabled={!state.canUndo}
          onClick={() => chain().undo().run()}
        >
          <UndoOutlined fontSize="small" />
        </IconButton>
        <IconButton
          label={t('editor.redo')}
          size="small"
          disabled={!state.canRedo}
          onClick={() => chain().redo().run()}
        >
          <RedoOutlined fontSize="small" />
        </IconButton>
      </Toolbar>

      <Dialog open={linkOpen} onClose={closeLink} aria-labelledby={titleId} fullWidth maxWidth="xs">
        <DialogTitle id={titleId}>{t('editor.linkTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            type="url"
            label={t('editor.linkLabel')}
            value={href}
            error={invalid}
            helperText={invalid ? t('editor.linkInvalid') : t('editor.linkHelp')}
            onChange={(event) => {
              setHref(event.target.value);
              setInvalid(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          {state.link && (
            <Button color="error" onClick={removeLink} sx={{ mr: 'auto' }}>
              {t('editor.linkRemove')}
            </Button>
          )}
          <Button onClick={closeLink}>{t('editor.cancel')}</Button>
          <Button variant="contained" onClick={applyLink}>
            {t('editor.linkApply')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
