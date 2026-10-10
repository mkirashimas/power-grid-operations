import { WEATHER_ZONES } from '@pgo/grid-model';
import type { StudyEdit } from './engine/study';
import { DEFAULT_NETWORK_STATE, type NetworkState, type ZoneScope } from './slice';

/** Search params this view owns; the rest of the URL (e.g. `asset`) is kept. */
export const SEARCH_KEYS = ['mode', 'zone', 'study'] as const;

const ID = /^[a-z0-9-]{1,40}$/;
const MAX_EDITS = 50;

/**
 * Edits as a compact, readable string: `t.ln-0012~l.sub-cst-001.20~o.gen-cst-003`
 * (trip a line, change a substation's load by +20 %, take a generator offline).
 */
export const encodeEdits = (edits: readonly StudyEdit[]) =>
  edits
    .map((edit) =>
      edit.type === 'trip'
        ? `t.${edit.assetId}`
        : edit.type === 'offline'
          ? `o.${edit.assetId}`
          : `l.${edit.assetId}.${edit.percent}`,
    )
    .join('~');

/** Parses `encodeEdits` output; malformed parts are dropped and load changes are clamped. */
export const decodeEdits = (value: string | null): StudyEdit[] => {
  if (!value) return [];
  return value
    .split('~')
    .slice(0, MAX_EDITS)
    .flatMap((part): StudyEdit[] => {
      const [type, assetId, percent] = part.split('.');
      if (!assetId || !ID.test(assetId)) return [];
      if (type === 't') return [{ type: 'trip', assetId }];
      if (type === 'o') return [{ type: 'offline', assetId }];
      const value = Number(percent);
      if (type === 'l' && Number.isFinite(value) && value !== 0) {
        return [{ type: 'load', assetId, percent: Math.max(-50, Math.min(50, Math.round(value))) }];
      }
      return [];
    });
};

export const toSearchParams = ({ mode, zone, edits }: NetworkState): URLSearchParams => {
  const params = new URLSearchParams();
  if (mode !== DEFAULT_NETWORK_STATE.mode) params.set('mode', mode);
  if (zone !== DEFAULT_NETWORK_STATE.zone) params.set('zone', zone);
  if (edits.length) params.set('study', encodeEdits(edits));
  return params;
};

export const fromSearchParams = (params: URLSearchParams): NetworkState => {
  const zone = params.get('zone');
  return {
    mode: params.get('mode') === 'study' ? 'study' : 'live',
    zone: (WEATHER_ZONES as readonly string[]).includes(zone ?? '') ? (zone as ZoneScope) : 'all',
    edits: decodeEdits(params.get('study')),
  };
};
