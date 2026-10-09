'use client';

import { Box, Stack } from '@mui/material';
import type { JSONContent } from '@tiptap/core';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../../../store';
import { selectAsset } from '../../../store/selectionSlice';
import {
  createAssetMention,
  mentionAttrs,
  type AssetSuggestion,
  type MentionBridge,
} from '../editor/assetMention';
import { isSafeLink } from '../editor/links';
import { INCIDENTS_NAMESPACE } from '../i18n';
import { EditorToolbar } from './EditorToolbar';
import { MentionList } from './MentionList';

const SAVE_DELAY_MS = 600;

interface ReportEditorProps {
  /** The stored document; read once when the editor is created. */
  initialContent: JSONContent;
  onSave: (body: JSONContent) => void;
}

/**
 * The report text (Tiptap): headings, marks, lists, action items, links and @-mentions of
 * grid assets. Changes are saved after a short pause and when the editor goes away.
 */
export const ReportEditor = ({ initialContent, onSave }: ReportEditorProps) => {
  const { t } = useTranslation(INCIDENTS_NAMESPACE);
  const dispatch = useAppDispatch();
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const [suggestion, setSuggestion] = useState<AssetSuggestion | null>(null);
  const [active, setActive] = useState(0);

  // Latest values for callbacks that Tiptap keeps from the first render.
  const latest = useRef({ suggestion, active, onSave });
  useEffect(() => {
    latest.current = { suggestion, active, onSave };
  });

  // Stable callbacks for the suggestion plugin; they read the latest state through `latest`.
  const [bridge] = useState<MentionBridge>(() => ({
    onChange: (next) => {
      setSuggestion(next);
      if (!next || next.query !== latest.current.suggestion?.query) setActive(0);
    },
    onKeyDown: (event) => {
      const current = latest.current.suggestion;
      if (!current) return false;
      const count = current.items.length;
      if (event.key === 'Escape') {
        setSuggestion(null);
        return true;
      }
      if (!count) return false;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const asset = current.items[latest.current.active];
        if (asset) current.command(mentionAttrs(asset));
        return true;
      }
      return false;
    },
  }));

  const pending = useRef<JSONContent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current) latest.current.onSave(pending.current);
    pending.current = null;
  };

  const editor = useEditor({
    // Rendered on the client only after the report loads; this avoids a hydration mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          isAllowedUri: (url) => isSafeLink(url),
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        a11y: {
          checkboxLabel: (node) =>
            t('editor.taskCheckbox', { text: node.textContent || t('editor.emptyTask') }),
        },
      }),
      Placeholder.configure({ placeholder: t('editor.placeholder') }),
      createAssetMention(bridge),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': t('editor.label'),
        'data-testid': 'report-editor',
      },
    },
    onUpdate: ({ editor: current }) => {
      pending.current = current.getJSON();
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
  });

  // Save what is pending when leaving the page.
  useEffect(() => () => flush(), []);

  // While the asset list is open, the editor points at the highlighted option.
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    const open = Boolean(suggestion?.items.length);
    // A textbox can't take aria-expanded; aria-autocomplete and aria-activedescendant say
    // that a list is open and which option is highlighted.
    if (open) {
      dom.setAttribute('aria-autocomplete', 'list');
      dom.setAttribute('aria-controls', listId);
      dom.setAttribute('aria-activedescendant', optionId(active));
    } else {
      dom.removeAttribute('aria-autocomplete');
      dom.removeAttribute('aria-controls');
      dom.removeAttribute('aria-activedescendant');
    }
    // optionId only depends on listId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, suggestion, active, listId]);

  // Clicking a mention selects its asset everywhere (M7).
  const onClick = (event: React.MouseEvent) => {
    const mention = (event.target as HTMLElement).closest<HTMLElement>('[data-type="mention"]');
    const id = mention?.dataset.id;
    if (id) dispatch(selectAsset(id));
  };

  if (!editor) return null;

  return (
    <Stack spacing={1}>
      <EditorToolbar editor={editor} />
      <Box
        onClick={onClick}
        sx={(theme) => ({
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          '&:focus-within': { borderColor: 'primary.main' },
          '& .tiptap': {
            minHeight: 280,
            px: 2,
            py: 1.5,
            outline: 'none',
            ...theme.typography.body1,
            '& h2': { ...theme.typography.h6, mt: 2, mb: 1 },
            '& h3': { ...theme.typography.subtitle1, fontWeight: 600, mt: 2, mb: 1 },
            '& p': { my: 1 },
            '& ul, & ol': { pl: 3 },
            '& a': { color: 'primary.main' },
            '& p.is-editor-empty:first-of-type::before': {
              content: 'attr(data-placeholder)',
              color: 'text.secondary',
              float: 'left',
              height: 0,
              pointerEvents: 'none',
            },
            '& ul[data-type="taskList"]': {
              listStyle: 'none',
              pl: 0.5,
              '& li': { display: 'flex', alignItems: 'flex-start', gap: 1 },
              '& li > label': { mt: 1.25 },
              '& li > div': { flex: 1 },
              '& li[data-checked="true"] > div': {
                color: 'text.secondary',
                textDecoration: 'line-through',
              },
            },
            '& .asset-mention': {
              px: 0.5,
              borderRadius: 1,
              bgcolor: 'action.selected',
              color: 'text.primary',
              fontWeight: 600,
              cursor: 'pointer',
              boxDecorationBreak: 'clone',
            },
          },
          [theme.breakpoints.down('sm')]: { '& .tiptap': { minHeight: 200, px: 1.5 } },
        })}
      >
        <EditorContent editor={editor} />
      </Box>
      <MentionList suggestion={suggestion} active={active} listId={listId} optionId={optionId} />
    </Stack>
  );
};
