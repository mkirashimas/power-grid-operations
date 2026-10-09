'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { replaceSearchParams } from '../../../store/url';
import { restoreFilters, selectIncidentFilters } from '../slice';
import { filtersFromSearchParams, filtersToSearchParams, LIST_SEARCH_KEYS } from '../url';

/**
 * Keeps the list filters and the URL in step: the URL wins when the page opens, then every
 * change is mirrored with history.replaceState (no server round trip).
 */
export const useIncidentListUrlSync = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectIncidentFilters);
  const searchParams = useSearchParams();
  const [initial] = useState(() =>
    filtersFromSearchParams(new URLSearchParams(searchParams.toString())),
  );
  // The first URL write would still see the store's previous filters; skip it.
  const skipWrite = useRef(true);

  useEffect(() => {
    dispatch(restoreFilters(initial));
  }, [dispatch, initial]);

  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    replaceSearchParams(LIST_SEARCH_KEYS, filtersToSearchParams(filters));
  }, [filters]);
};
