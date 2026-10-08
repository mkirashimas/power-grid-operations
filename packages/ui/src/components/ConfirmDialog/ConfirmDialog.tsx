'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useId } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Called on Cancel, Escape and a backdrop click. */
  onCancel: () => void;
  /** Styles the confirm button as destructive, e.g. for "Delete". */
  destructive?: boolean;
}

/** Asks for confirmation. Focus stays inside until it closes; Escape cancels. */
export const ConfirmDialog = ({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) => {
  const titleId = useId();
  const bodyId = useId();
  return (
    <Dialog open={open} onClose={onCancel} aria-labelledby={titleId} aria-describedby={bodyId}>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={bodyId}>{body}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          autoFocus={!destructive}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
