'use client';

import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group, e.g. "Downsampling engine". */
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: 'small' | 'medium';
}

/** Exactly one of a few options, e.g. "JS" or "WASM". Clicking the active option keeps it. */
export const SegmentedControl = <T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'small',
}: SegmentedControlProps<T>) => (
  <ToggleButtonGroup
    aria-label={label}
    value={value}
    exclusive
    size={size}
    onChange={(_, next: T | null) => {
      if (next !== null) onChange(next);
    }}
  >
    {options.map((option) => (
      <ToggleButton key={option.value} value={option.value} sx={{ gap: 0.75, px: 1.5 }}>
        {option.icon}
        {option.label}
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);
