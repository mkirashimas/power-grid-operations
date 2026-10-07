import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Base API for the Next.js route handlers under /api. Features add their own endpoints and
// tag types via api.enhanceEndpoints({ addTagTypes: [...] }).injectEndpoints(...).
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: () => ({}),
});
