'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { restoreFilters, selectFilters } from '../slice';
import { fromSearchParams, toSearchParams } from '../url';

/**
 * Keeps the alarm filters and the URL in step: the URL wins when the page opens, then every
 * change is mirrored with history.replaceState (no server round trip).
 */
export const useAlarmsUrlSync = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectFilters);
  const searchParams = useSearchParams();
  const [initial] = useState(() => fromSearchParams(new URLSearchParams(searchParams.toString())));
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
    const search = toSearchParams(filters).toString();
    if (search !== window.location.search.replace(/^\?/, '')) {
      window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
    }
  }, [filters]);
};
