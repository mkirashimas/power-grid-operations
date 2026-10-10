'use client';

import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { Box, Drawer, Stack, Toolbar, Typography } from '@mui/material';
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { IconButton } from '../IconButton/IconButton.tsx';

export interface HelpSection {
  heading: string;
  /** A short paragraph. */
  body?: string;
  /** A bulleted list, e.g. technical details. */
  items?: string[];
}

export interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: HelpSection[];
  /** Accessible name and tooltip of the close button. */
  closeLabel: string;
  /**
   * `side`: a docked right panel that pushes the page (desktop).
   * `sheet`: a modal bottom sheet (phones).
   */
  variant?: 'side' | 'sheet';
  /** Id of the panel, for the opener's `aria-controls`. */
  id?: string;
  /** Width of the side panel, in px. */
  width?: number;
}

/** Plain-language help for the current page: a titled list of short sections. */
export const HelpPanel = ({
  open,
  onClose,
  title,
  sections,
  closeLabel,
  variant = 'side',
  id,
  width = 360,
}: HelpPanelProps) => {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const side = variant === 'side';

  // The side panel is not modal, so it moves focus itself: to the heading on open, and back to
  // whatever opened it on close. The sheet gets both from the MUI Modal.
  useEffect(() => {
    if (!side) {
      return;
    }
    if (open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      headingRef.current?.focus();
    } else if (openerRef.current?.isConnected) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [open, side]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (side && event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  const content = (
    <Box
      component="aside"
      id={id}
      aria-labelledby={headingId}
      onKeyDown={handleKeyDown}
      sx={{ p: 2, overflowY: 'auto' }}
    >
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          variant="h6"
          component="h2"
          sx={{ flexGrow: 1, outline: 'none' }}
        >
          {title}
        </Typography>
        <IconButton label={closeLabel} onClick={onClose} edge="end">
          <CloseOutlined />
        </IconButton>
      </Stack>
      <Stack spacing={2}>
        {sections.map(({ heading, body, items }) => (
          <Box key={heading}>
            <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 'fontWeightMedium' }}>
              {heading}
            </Typography>
            {body && (
              <Typography variant="body2" color="text.secondary">
                {body}
              </Typography>
            )}
            {items && items.length > 0 && (
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {items.map((item) => (
                  <Typography
                    key={item}
                    component="li"
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    {item}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );

  if (!side) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            'aria-labelledby': headingId,
            sx: (theme) => ({
              maxHeight: '80vh',
              borderTopLeftRadius: theme.shape.borderRadius,
              borderTopRightRadius: theme.shape.borderRadius,
            }),
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="persistent"
      anchor="right"
      open={open}
      // A closed panel leaves no hidden headings in the page outline.
      slotProps={{ transition: { unmountOnExit: true } }}
      sx={(theme) => ({
        width: open ? width : 0,
        flexShrink: 0,
        transition: theme.transitions.create('width', {
          duration: open
            ? theme.transitions.duration.enteringScreen
            : theme.transitions.duration.leavingScreen,
        }),
        '& .MuiDrawer-paper': { width, boxSizing: 'border-box' },
      })}
    >
      {/* Room for the app bar, as in the navigation drawer. */}
      <Toolbar />
      {content}
    </Drawer>
  );
};
