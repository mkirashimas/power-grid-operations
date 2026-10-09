'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { restoreView, selectChartsView } from '../slice';
import { fromSearchParams, toSearchParams } from '../url';

/**
 * Keeps the chart view (range, downsampling engine and algorithm) and the URL in step: the URL
 * wins when the page opens, then every change is mirrored with history.replaceState (no
 * server round trip).
 */
export const useChartsUrlSync = () => {
  const dispatch = useAppDispatch();
  const view = useAppSelector(selectChartsView);
  const searchParams = useSearchParams();
  const [initial] = useState(() => fromSearchParams(new URLSearchParams(searchParams.toString())));
  // The first URL write would still see the store's previous view; skip it.
  const skipWrite = useRef(true);

  useEffect(() => {
    dispatch(restoreView(initial));
  }, [dispatch, initial]);

  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    const search = toSearchParams(view).toString();
    if (search !== window.location.search.replace(/^\?/, '')) {
      window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
    }
  }, [view]);
};
