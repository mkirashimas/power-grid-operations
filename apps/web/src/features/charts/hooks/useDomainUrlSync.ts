'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import { selectDomain, setDomain } from '../slice';
import { fromSearchParams, toSearchParams } from '../url';

/**
 * Keeps the visible range and the URL in step: the URL wins when the page opens, then every
 * change is mirrored with history.replaceState (no server round trip).
 */
export const useDomainUrlSync = () => {
  const dispatch = useAppDispatch();
  const domain = useAppSelector(selectDomain);
  const searchParams = useSearchParams();
  const [initial] = useState(() => fromSearchParams(new URLSearchParams(searchParams.toString())));
  // The first URL write would still see the store's previous range; skip it.
  const skipWrite = useRef(true);

  useEffect(() => {
    dispatch(setDomain(initial));
  }, [dispatch, initial]);

  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    const search = toSearchParams(domain).toString();
    if (search !== window.location.search.replace(/^\?/, '')) {
      window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
    }
  }, [domain]);
};
