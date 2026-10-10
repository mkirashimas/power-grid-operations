'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { findAsset } from '../store/assets';
import { selectAsset, selectSelectedAssetId } from '../store/selectionSlice';
import { replaceSearchParams } from '../store/url';

const ASSET_KEY = ['asset'] as const;

/**
 * Keeps the linked selection in the URL as `asset`, on every page: the URL wins when the app
 * opens (unknown ids are ignored), then each selection and each page change writes it back.
 * Reads window.location rather than useSearchParams, so the root layout needs no Suspense.
 */
export const useSelectionUrlSync = () => {
  const dispatch = useAppDispatch();
  const assetId = useAppSelector(selectSelectedAssetId);
  const pathname = usePathname();
  // The first write would still see the store's empty selection; skip it.
  const skipWrite = useRef(true);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('asset');
    if (id && findAsset(id)) dispatch(selectAsset(id));
  }, [dispatch]);

  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (assetId) params.set('asset', assetId);
    replaceSearchParams(ASSET_KEY, params);
  }, [assetId, pathname]);
};
