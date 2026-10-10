'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { replaceSearchParams } from '../../../store/url';
import { replaceQuery, selectQuery } from '../slice';
import { fromSearchParams, SEARCH_KEYS, toSearchParams } from '../url';

/**
 * Keeps the query and the URL in step: the URL wins when the page opens, then every change
 * is mirrored with history.replaceState, which Next.js tracks without a server round trip.
 */
export const useQueryUrlSync = () => {
  const dispatch = useAppDispatch();
  const query = useAppSelector(selectQuery);
  const searchParams = useSearchParams();
  const [initial] = useState(() => fromSearchParams(new URLSearchParams(searchParams.toString())));
  // The first URL write would still see the store's previous query; skip it.
  const skipWrite = useRef(true);

  useEffect(() => {
    dispatch(replaceQuery(initial));
  }, [dispatch, initial]);

  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    replaceSearchParams(SEARCH_KEYS, toSearchParams(query));
  }, [query]);
};
