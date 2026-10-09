import { INCIDENT_STATUSES, type StatusFilter } from './model';
import { DEFAULT_FILTERS, type IncidentFilters } from './slice';

const STATUS_FILTERS: readonly StatusFilter[] = ['all', ...INCIDENT_STATUSES];
const MAX_QUERY_LENGTH = 100;
const ATTACHMENT_ID = /^att-[a-z0-9-]{1,40}$/;

/** Search params the list owns; the rest of the URL (e.g. `asset`) is kept. */
export const LIST_SEARCH_KEYS = ['status', 'q'] as const;

export const filtersToSearchParams = ({ status, query }: IncidentFilters): URLSearchParams => {
  const params = new URLSearchParams();
  if (status !== DEFAULT_FILTERS.status) params.set('status', status);
  if (query.trim()) params.set('q', query.trim());
  return params;
};

export const filtersFromSearchParams = (params: URLSearchParams): IncidentFilters => ({
  status:
    STATUS_FILTERS.find((status) => status === params.get('status')) ?? DEFAULT_FILTERS.status,
  query: (params.get('q') ?? '').slice(0, MAX_QUERY_LENGTH),
});

/** Search params a report owns: the open attachment and its page. */
export const REPORT_SEARCH_KEYS = ['doc', 'page'] as const;

export interface ViewerLocation {
  doc: string | null;
  page: number;
}

export const viewerToSearchParams = ({ doc, page }: ViewerLocation): URLSearchParams => {
  const params = new URLSearchParams();
  if (doc) {
    params.set('doc', doc);
    if (page > 1) params.set('page', String(page));
  }
  return params;
};

/** Malformed values fall back to no document and page 1; the viewer clamps the page. */
export const viewerFromSearchParams = (params: URLSearchParams): ViewerLocation => {
  const doc = params.get('doc');
  const page = Number(params.get('page'));
  const valid = doc !== null && ATTACHMENT_ID.test(doc);
  return {
    doc: valid ? doc : null,
    page: valid && Number.isInteger(page) && page > 1 ? Math.min(page, 9_999) : 1,
  };
};
