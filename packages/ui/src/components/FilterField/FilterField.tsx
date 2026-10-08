'use client';

import ClearOutlined from '@mui/icons-material/ClearOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { InputAdornment, TextField } from '@mui/material';
import { useRef } from 'react';
import { IconButton } from '../IconButton/IconButton.tsx';

export interface FilterFieldProps {
  /** Visible label, e.g. "Filter assets". */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Name of the clear button, e.g. "Clear filter". */
  clearLabel: string;
  placeholder?: string;
}

/** A search input with a clear button. Escape also clears it. */
export const FilterField = ({
  label,
  value,
  onChange,
  clearLabel,
  placeholder,
}: FilterFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const clear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <TextField
      label={label}
      value={value}
      placeholder={placeholder}
      size="small"
      type="search"
      inputRef={inputRef}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && value) {
          event.preventDefault();
          clear();
        }
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchOutlined fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton label={clearLabel} size="small" edge="end" onClick={clear}>
                <ClearOutlined fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
};
