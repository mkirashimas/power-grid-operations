import { Serwist } from '@serwist/window';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PATHS } from '../types';

/**
 * Registers the service worker (production builds only: in `next dev` it would cache stale
 * code) and reports when a new version is waiting. `applyUpdate()` activates it and reloads the
 * page once it has taken over; until then the open page keeps running the old version.
 */
export const useServiceWorker = ({ enabled = process.env.NODE_ENV === 'production' } = {}) => {
  const serwistRef = useRef<Serwist | null>(null);
  const updatingRef = useRef(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return;
    // The bundle is an ES module (Serwist builds it with esbuild, format "esm").
    const serwist = new Serwist(PATHS.SERVICE_WORKER, { scope: '/', type: 'module' });
    serwistRef.current = serwist;

    const onWaiting = () => setUpdateReady(true);
    const onControlling = () => {
      if (updatingRef.current) window.location.reload();
    };
    serwist.addEventListener('waiting', onWaiting);
    serwist.addEventListener('controlling', onControlling);
    void serwist.register().catch(() => {
      // No service worker (e.g. private browsing): the app still works online.
    });

    return () => {
      serwist.removeEventListener('waiting', onWaiting);
      serwist.removeEventListener('controlling', onControlling);
      serwistRef.current = null;
    };
  }, [enabled]);

  const applyUpdate = useCallback(() => {
    updatingRef.current = true;
    serwistRef.current?.messageSkipWaiting();
  }, []);

  const dismissUpdate = useCallback(() => setUpdateReady(false), []);

  return { updateReady, applyUpdate, dismissUpdate };
};
