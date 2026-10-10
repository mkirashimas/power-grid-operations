import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/** Chromium's install prompt event; not in the DOM typings. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STANDALONE_QUERY = '(display-mode: standalone)';

const subscribeStandalone = (onChange: () => void) => {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener('change', onChange);
  window.addEventListener('appinstalled', onChange);
  return () => {
    query.removeEventListener('change', onChange);
    window.removeEventListener('appinstalled', onChange);
  };
};

/** Running as an installed app (iOS sets `navigator.standalone` instead of the media query). */
export const isStandalone = () =>
  window.matchMedia(STANDALONE_QUERY).matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone, iPod or iPad (iPadOS reports itself as a Mac with touch). */
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const noSubscription = () => () => {};

/**
 * Install support for the top bar:
 * - `canInstall`: the browser offered an install prompt (Chromium); `install()` shows it.
 * - `showIosHint`: iOS Safari, which has no prompt; the user adds the app from the Share menu.
 * Both are false once the app runs installed, and on the server.
 */
export const useInstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone, () => false);
  const ios = useSyncExternalStore(noSubscription, isIos, () => false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Keep the browser's mini-infobar away; the top-bar button offers the install instead.
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    // A prompt can be shown only once; the browser fires a new event if it may ask again.
    setPromptEvent(null);
  }, [promptEvent]);

  return {
    canInstall: !standalone && promptEvent !== null,
    showIosHint: !standalone && ios,
    install,
  };
};
