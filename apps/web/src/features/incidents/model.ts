import { ALARM_SEVERITIES, type AlarmSeverity } from '@pgo/grid-model';
import type { JSONContent } from '@tiptap/core';

export const INCIDENT_STATUSES = ['open', 'investigating', 'resolved'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** Incidents use the alarm severities, so both read the same across the app. */
export const INCIDENT_SEVERITIES = ALARM_SEVERITIES;
export type IncidentSeverity = AlarmSeverity;

/** A PDF attached to a report: a shipped sample (`url`) or an upload kept in IndexedDB. */
export interface Attachment {
  id: string;
  name: string;
  size: number;
  source: 'sample' | 'upload';
  /** Samples only: the file under /public. */
  url?: string;
  addedAt: number;
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  /** Assets linked in the header; mentions in the body are linked too (see `linkedAssetIds`). */
  assetIds: string[];
  /** Epoch ms. */
  startedAt: number;
  resolvedAt?: number;
  /** Tiptap document. */
  body: JSONContent;
  attachments: Attachment[];
  /** Shipped with the demo, restored by Reset. */
  sample: boolean;
  createdAt: number;
  updatedAt: number;
}

/** What the header can change; the body has its own autosave. */
export type IncidentChanges = Partial<
  Pick<Incident, 'title' | 'severity' | 'status' | 'assetIds' | 'startedAt' | 'resolvedAt' | 'body'>
>;

export const MAX_TITLE_LENGTH = 120;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const EMPTY_BODY: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

/** A short random id, e.g. `inc-3f9a1c2b`. */
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export const createIncident = ({
  title,
  assetIds = [],
  now = Date.now(),
}: {
  title: string;
  assetIds?: string[];
  now?: number;
}): Incident => ({
  id: newId('inc'),
  title: title.slice(0, MAX_TITLE_LENGTH),
  severity: 'warning',
  status: 'open',
  assetIds: [...new Set(assetIds)],
  startedAt: now,
  body: EMPTY_BODY,
  attachments: [],
  sample: false,
  createdAt: now,
  updatedAt: now,
});

/** Applies header or body changes; resolving stamps `resolvedAt`, reopening clears it. */
export const applyChanges = (incident: Incident, changes: IncidentChanges, now = Date.now()) => {
  const next: Incident = { ...incident, ...changes, updatedAt: now };
  if (changes.title !== undefined) next.title = changes.title.slice(0, MAX_TITLE_LENGTH);
  if (changes.status && changes.status !== incident.status) {
    if (changes.status === 'resolved') next.resolvedAt = changes.resolvedAt ?? now;
    else delete next.resolvedAt;
  }
  return next;
};

/** Ids of the assets mentioned in a Tiptap document, in order of first mention. */
export const mentionedAssetIds = (body: JSONContent): string[] => {
  const ids: string[] = [];
  const visit = (node: JSONContent) => {
    const id = node.attrs?.id;
    if (node.type === 'mention' && typeof id === 'string' && !ids.includes(id)) ids.push(id);
    node.content?.forEach(visit);
  };
  visit(body);
  return ids;
};

/** Header assets first, then assets mentioned in the body. */
export const linkedAssetIds = (incident: Pick<Incident, 'assetIds' | 'body'>) => [
  ...new Set([...incident.assetIds, ...mentionedAssetIds(incident.body)]),
];

/** The document's plain text, for search. */
export const plainText = (body: JSONContent): string => {
  const parts: string[] = [];
  const visit = (node: JSONContent) => {
    if (node.text) parts.push(node.text);
    if (node.type === 'mention' && typeof node.attrs?.label === 'string')
      parts.push(node.attrs.label);
    node.content?.forEach(visit);
  };
  visit(body);
  return parts.join(' ');
};

export type StatusFilter = 'all' | IncidentStatus;

/** Newest activity first; `query` matches the title, the text and the asset ids. */
export const filterIncidents = (
  incidents: readonly Incident[],
  status: StatusFilter,
  query: string,
): Incident[] => {
  const needle = query.trim().toLowerCase();
  return incidents
    .filter((incident) => status === 'all' || incident.status === status)
    .filter(
      (incident) =>
        !needle ||
        [incident.title, plainText(incident.body), ...linkedAssetIds(incident)]
          .join(' ')
          .toLowerCase()
          .includes(needle),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** True when the bytes start with the PDF signature. */
export const isPdf = (bytes: Uint8Array) =>
  bytes.length >= PDF_SIGNATURE.length &&
  PDF_SIGNATURE.every((byte, index) => bytes[index] === byte);

export type UploadProblem = 'type' | 'size' | 'empty';

/** Why a file can't be attached, or null. The content check (`isPdf`) runs on its bytes. */
export const checkUpload = (file: Pick<File, 'type' | 'size' | 'name'>): UploadProblem | null => {
  if (file.size === 0) return 'empty';
  if (file.size > MAX_UPLOAD_BYTES) return 'size';
  const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  return looksLikePdf ? null : 'type';
};
