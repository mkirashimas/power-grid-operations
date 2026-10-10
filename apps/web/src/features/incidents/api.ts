import { api } from '../../store/api';
import {
  applyChanges,
  createIncident,
  type Attachment,
  type Incident,
  type IncidentChanges,
} from './model';
import * as db from './storage/db';

// Endpoints over IndexedDB (queryFn, no fetch): reports never leave the browser.

const TAG = 'Incident';
const LIST = { type: TAG, id: 'LIST' } as const;

/** Runs a storage call and maps a failure to an RTK Query error. */
const run = async <T>(call: () => Promise<T>) => {
  try {
    return { data: await call() };
  } catch (error) {
    return {
      error: {
        status: 'CUSTOM_ERROR' as const,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
};

/** A missing report is an error for mutations (a query returns null instead). */
const required = (incident: Incident | null, id: string) => {
  if (!incident) throw new Error(`Incident ${id} not found`);
  return incident;
};

export const incidentsApi = api.enhanceEndpoints({ addTagTypes: [TAG] }).injectEndpoints({
  endpoints: (build) => ({
    listIncidents: build.query<Incident[], void>({
      queryFn: () => run(db.listIncidents),
      providesTags: (incidents = []) => [
        LIST,
        ...incidents.map(({ id }) => ({ type: TAG, id }) as const),
      ],
    }),
    getIncident: build.query<Incident | null, string>({
      queryFn: (id) => run(() => db.getIncident(id)),
      providesTags: (_incident, _error, id) => [{ type: TAG, id }],
    }),
    createIncident: build.mutation<Incident, { title: string; assetIds?: string[] }>({
      queryFn: (draft) => run(() => db.putIncident(createIncident(draft))),
      invalidatesTags: [LIST],
    }),
    /**
     * Saves header or body changes. The cached report is patched first, and only the list is
     * refetched: refetching the report would reset the editor while the user types.
     */
    updateIncident: build.mutation<Incident, { id: string; changes: IncidentChanges }>({
      queryFn: ({ id, changes }) =>
        run(async () =>
          required(await db.updateIncident(id, (incident) => applyChanges(incident, changes)), id),
        ),
      async onQueryStarted({ id, changes }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          incidentsApi.util.updateQueryData('getIncident', id, (draft) =>
            draft ? applyChanges(draft, changes) : draft,
          ),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(incidentsApi.util.upsertQueryData('getIncident', id, data));
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [LIST],
    }),
    deleteIncident: build.mutation<null, string>({
      queryFn: (id) => run(async () => (await db.deleteIncident(id), null)),
      invalidatesTags: (_result, _error, id) => [LIST, { type: TAG, id }],
    }),
    /** Adds an attachment whose file is already stored (see storage/uploads.ts). */
    addAttachment: build.mutation<Incident, { id: string; attachment: Attachment }>({
      queryFn: ({ id, attachment }) =>
        run(async () =>
          required(
            await db.updateIncident(id, (incident) => ({
              ...incident,
              attachments: [...incident.attachments, attachment],
              updatedAt: Date.now(),
            })),
            id,
          ),
        ),
      invalidatesTags: (_result, _error, { id }) => [LIST, { type: TAG, id }],
    }),
    /** Removes an attachment, and its file if it was uploaded. */
    removeAttachment: build.mutation<Incident, { id: string; attachmentId: string }>({
      queryFn: ({ id, attachmentId }) =>
        run(async () => {
          const incident = required(
            await db.updateIncident(id, (current) => ({
              ...current,
              attachments: current.attachments.filter(({ id: other }) => other !== attachmentId),
              updatedAt: Date.now(),
            })),
            id,
          );
          await db.deleteFile(attachmentId);
          return incident;
        }),
      invalidatesTags: (_result, _error, { id }) => [LIST, { type: TAG, id }],
    }),
    /** Deletes everything in the browser and restores the sample reports. */
    resetIncidents: build.mutation<null, void>({
      queryFn: () => run(async () => (await db.resetIncidents(), null)),
      invalidatesTags: [TAG],
    }),
  }),
});

export const {
  useListIncidentsQuery,
  useGetIncidentQuery,
  useCreateIncidentMutation,
  useUpdateIncidentMutation,
  useDeleteIncidentMutation,
  useAddAttachmentMutation,
  useRemoveAttachmentMutation,
  useResetIncidentsMutation,
} = incidentsApi;
