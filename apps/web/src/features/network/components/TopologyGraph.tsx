'use client';

import '@xyflow/react/dist/style.css';
import type { TelemetryStatus } from '@pgo/grid-model';
import { motionDuration } from '@pgo/ui';
import { Box } from '@mui/material';
import { useColorScheme, useTheme } from '@mui/material/styles';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
} from '@xyflow/react';
import { useEffect, useId, useMemo, useRef, useState, memo } from 'react';
import type { GridNetwork } from '../engine/network';
import type { ZoneScope } from '../slice';
import { reuseUnchanged } from '../stable';
import { SUBSTATION_NODE_STYLES, SubstationNode, type SubstationFlowNode } from './SubstationNode';

const NODE_TYPES = { substation: SubstationNode };
/** Pixels per degree of longitude (latitude is scaled to match at Texas latitudes). */
const SCALE = 90;
const COS_LAT = Math.cos((31 * Math.PI) / 180);

const project = ({ lat, lon }: { lat: number; lon: number }) => ({
  x: (lon + 107) * SCALE * COS_LAT,
  y: (37 - lat) * SCALE,
});

// What a node or edge draws: when it is unchanged, the previous object is kept.
const sameNode = (a: SubstationFlowNode, b: SubstationFlowNode) =>
  a.position.x === b.position.x &&
  a.position.y === b.position.y &&
  a.data.label === b.data.label &&
  a.data.status === b.data.status &&
  a.data.selected === b.data.selected &&
  a.data.deEnergized === b.data.deEnergized;

const sameEdge = (a: Edge, b: Edge) =>
  a.source === b.source &&
  a.target === b.target &&
  a.style?.stroke === b.style?.stroke &&
  a.style?.strokeWidth === b.style?.strokeWidth &&
  a.style?.strokeDasharray === b.style?.strokeDasharray;

export interface TopologyGraphProps {
  network: GridNetwork;
  zone: ZoneScope;
  busStatus: (bus: number) => TelemetryStatus;
  lineStatus: (line: number) => { status: TelemetryStatus; tripped: boolean };
  deEnergized: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (assetId: string) => void;
  /** Accessible name: what the graph shows. */
  label: string;
  /** Read after the name, e.g. "use the asset tree to move by keyboard". */
  hint: string;
}

/** Where to centre for an asset: its substation, or the middle of a line. */
const focusPoint = (network: GridNetwork, assetId: string) => {
  const bus = network.busOf.get(assetId);
  if (bus !== undefined) return project(network.buses[bus]);
  const line = network.lines.find((item) => item.asset.id === assetId);
  if (line) return project(line.asset);
  const attached =
    network.loads.find((item) => item.asset.id === assetId) ??
    network.generators.find((item) => item.asset.id === assetId);
  return attached ? project(network.buses[attached.bus]) : undefined;
};

const Graph = ({
  network,
  zone,
  busStatus,
  lineStatus,
  deEnergized,
  selectedId,
  onSelect,
  label,
  hint,
}: TopologyGraphProps) => {
  const theme = useTheme();
  const palette = (theme.vars ?? theme).palette;
  const { mode, systemMode } = useColorScheme();
  const scheme = (mode === 'system' ? systemMode : mode) === 'dark' ? 'dark' : 'light';
  // Status colours as concrete values for the minimap; recomputed when the scheme changes.
  const minimapColors = useMemo(() => {
    const resolve = (value: string) => {
      const name = /var\((--[^,)]+)/.exec(value)?.[1];
      if (!name || typeof document === 'undefined') return value;
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || value;
    };
    return {
      normal: resolve(palette.status.normal),
      warning: resolve(palette.status.warning),
      alarm: resolve(palette.status.alarm),
    };
    // The palette strings stay the same; the values behind them change with the scheme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme]);
  const flow = useReactFlow();
  const hintId = useId();

  // The selected asset's substation (lines highlight themselves).
  const selectedBus = useMemo(() => {
    if (!selectedId) return undefined;
    const bus = network.busOf.get(selectedId);
    if (bus !== undefined) return bus;
    return (
      network.loads.find((item) => item.asset.id === selectedId) ??
      network.generators.find((item) => item.asset.id === selectedId)
    )?.bus;
  }, [network, selectedId]);

  // Previous nodes and edges, reused when unchanged (see reuseUnchanged).
  const [nodeCache] = useState(() => new Map<string, SubstationFlowNode>());
  const [edgeCache] = useState(() => new Map<string, Edge>());

  const nodes: SubstationFlowNode[] = useMemo(
    () =>
      reuseUnchanged(
        nodeCache,
        network.buses.flatMap((bus, index) =>
          zone !== 'all' && bus.zone !== zone
            ? []
            : [
                {
                  id: bus.id,
                  type: 'substation' as const,
                  position: project(bus),
                  data: {
                    label: bus.name,
                    status: busStatus(index),
                    selected: selectedBus === index,
                    deEnergized: deEnergized.has(bus.id),
                  },
                  draggable: false,
                  connectable: false,
                  // Fixed size: the minimap only draws nodes with known dimensions, and these
                  // nodes are not fed back through onNodesChange (the graph is read-only).
                  width: 10,
                  height: 10,
                },
              ],
        ),
        sameNode,
      ),
    [network, zone, busStatus, selectedBus, deEnergized, nodeCache],
  );

  const edges: Edge[] = useMemo(() => {
    const visible = new Set(nodes.map((node) => node.id));
    const next = network.lines.flatMap((line, index) => {
      const source = network.buses[line.from].id;
      const target = network.buses[line.to].id;
      if (!visible.has(source) || !visible.has(target)) return [];
      const { status, tripped } = lineStatus(index);
      const selected = line.asset.id === selectedId;
      return [
        {
          id: line.asset.id,
          source,
          target,
          type: 'straight',
          interactionWidth: 12,
          style: {
            stroke: selected
              ? palette.primary.main
              : tripped
                ? palette.text.disabled
                : palette.status[status],
            strokeWidth: selected ? 4 : line.asset.voltageKv >= 345 ? 2.5 : 1.25,
            strokeDasharray: tripped ? '4 4' : undefined,
          },
        },
      ];
    });
    return reuseUnchanged(edgeCache, next, sameEdge);
  }, [network, nodes, lineStatus, selectedId, palette, edgeCache]);

  // The first view: centred on the selected asset (e.g. a shared link), or the whole grid.
  const ready = useRef(false);
  const centreOn = (assetId: string | null, duration: number) => {
    const point = assetId ? focusPoint(network, assetId) : undefined;
    if (point) flow.setCenter(point.x, point.y, { zoom: Math.max(flow.getZoom(), 1.6), duration });
    return Boolean(point);
  };
  const onInit = () => {
    ready.current = true;
    if (!centreOn(selectedId, 0)) flow.fitView({ padding: 0.1 });
  };

  // Later selections, from anywhere (tree, map, a result row), are centred.
  useEffect(() => {
    if (ready.current && selectedId) centreOn(selectedId, motionDuration(400));
    // centreOn reads the network and flow, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // A new zone filter shows the whole zone (not on the first render: onInit decides that).
  const shownZone = useRef(zone);
  useEffect(() => {
    if (!ready.current || shownZone.current === zone) return;
    shownZone.current = zone;
    const frame = requestAnimationFrame(() =>
      flow.fitView({ padding: 0.1, duration: motionDuration(300) }),
    );
    return () => cancelAnimationFrame(frame);
  }, [zone, flow]);

  return (
    <Box
      role="region"
      aria-label={label}
      aria-describedby={hintId}
      data-testid="topology-graph"
      sx={(t) => ({
        height: 'min(70vh, 640px)',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        ...SUBSTATION_NODE_STYLES,
        [t.breakpoints.down('sm')]: { height: 420 },
      })}
    >
      <span id={hintId} hidden>
        {hint}
      </span>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={(_, node) => onSelect(node.id)}
        onEdgeClick={(_, edge) => onSelect(edge.id)}
        onInit={onInit}
        minZoom={0.3}
        maxZoom={6}
        // The page keeps scrolling with the wheel; Ctrl + wheel or a pinch zooms.
        zoomOnScroll={false}
        zoomActivationKeyCode="Control"
        preventScrolling={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        // 400 nodes as tab stops would bury the page; the asset tree is the keyboard path.
        nodesFocusable={false}
        edgesFocusable={false}
        onlyRenderVisibleElements
        colorMode={scheme}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={24} size={1} />
        <MiniMap
          pannable
          zoomable
          ariaLabel={label}
          // The minimap sets colours as SVG attributes, which cannot read CSS variables.
          nodeColor={(node) => minimapColors[(node.data as { status: TelemetryStatus }).status]}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </Box>
  );
};

/** The grid as a graph: substations at their geographic positions, lines between them. */
/** Memoised: the network view re-renders on every live tick; the graph only when its props change. */
export const TopologyGraph = memo(function TopologyGraph(props: TopologyGraphProps) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
});
