'use client';

import type { TelemetryStatus } from '@pgo/grid-model';
import { Box } from '@mui/material';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';

export type SubstationNodeData = {
  label: string;
  status: TelemetryStatus;
  selected: boolean;
  /** No generation reaches it in the study. */
  deEnergized: boolean;
};

export type SubstationFlowNode = Node<SubstationNodeData, 'substation'>;

// Edges attach to the centre; the handles themselves are invisible.
const hiddenHandle = {
  top: '50%',
  left: '50%',
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  opacity: 0,
  border: 0,
  transform: 'translate(-50%, -50%)',
} as const;

/** A substation dot, coloured by status, ringed when selected; the name shows when selected. */
export const SubstationNode = memo(({ data }: NodeProps<SubstationFlowNode>) => (
  <Box sx={{ position: 'relative', width: 10, height: 10 }} title={data.label}>
    <Handle type="target" position={Position.Top} isConnectable={false} style={hiddenHandle} />
    <Handle type="source" position={Position.Top} isConnectable={false} style={hiddenHandle} />
    <Box
      sx={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        bgcolor: data.deEnergized ? 'text.disabled' : `status.${data.status}`,
        border: 1,
        borderColor: 'background.paper',
        boxShadow: (theme) =>
          data.selected ? `0 0 0 3px ${(theme.vars || theme).palette.primary.main}` : 'none',
      }}
    />
    {data.selected && (
      <Box
        component="span"
        sx={{
          position: 'absolute',
          left: 14,
          top: -4,
          px: 0.5,
          whiteSpace: 'nowrap',
          typography: 'caption',
          fontWeight: 600,
          bgcolor: 'background.paper',
          borderRadius: 0.5,
          pointerEvents: 'none',
        }}
      >
        {data.label}
      </Box>
    )}
  </Box>
));
SubstationNode.displayName = 'SubstationNode';
