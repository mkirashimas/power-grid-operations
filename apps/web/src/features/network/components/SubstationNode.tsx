'use client';

import type { TelemetryStatus } from '@pgo/grid-model';
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

/**
 * A substation dot, coloured by status, ringed when selected; the name shows when selected.
 * Plain elements with class names and data attributes: the graph styles all 400 of them with
 * one stylesheet (SUBSTATION_NODE_STYLES), instead of computing styles per node.
 */
export const SubstationNode = memo(({ data }: NodeProps<SubstationFlowNode>) => (
  <div className="pgo-substation" title={data.label}>
    <Handle type="target" position={Position.Top} isConnectable={false} style={hiddenHandle} />
    <Handle type="source" position={Position.Top} isConnectable={false} style={hiddenHandle} />
    <div
      className="pgo-substation-dot"
      data-status={data.deEnergized ? 'de-energized' : data.status}
      data-selected={data.selected || undefined}
    />
    {data.selected && <span className="pgo-substation-label">{data.label}</span>}
  </div>
));
SubstationNode.displayName = 'SubstationNode';

/** Styles for every SubstationNode, applied once on the graph's container (an `sx` object). */
export const SUBSTATION_NODE_STYLES = {
  '& .pgo-substation': { position: 'relative', width: 10, height: 10 },
  '& .pgo-substation-dot': {
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: 1,
    borderColor: 'background.paper',
    bgcolor: 'status.normal',
  },
  '& .pgo-substation-dot[data-status="warning"]': { bgcolor: 'status.warning' },
  '& .pgo-substation-dot[data-status="alarm"]': { bgcolor: 'status.alarm' },
  '& .pgo-substation-dot[data-status="de-energized"]': { bgcolor: 'text.disabled' },
  '& .pgo-substation-dot[data-selected]': {
    outline: 3,
    outlineStyle: 'solid',
    outlineColor: 'primary.main',
  },
  '& .pgo-substation-label': {
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
  },
} as const;
