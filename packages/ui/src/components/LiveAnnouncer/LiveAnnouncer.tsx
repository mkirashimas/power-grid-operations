'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden.tsx';

export type Politeness = 'polite' | 'assertive';

type Announce = (message: string, politeness?: Politeness) => void;

const AnnounceContext = createContext<Announce | null>(null);

// Long enough for screen readers to notice the region was emptied before the new text lands.
const RESET_MS = 50;

/**
 * Hosts two live regions (polite and assertive) for the whole app. Mount it once near the
 * root; components announce through useAnnounce().
 */
export const LiveAnnouncer = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<Record<Politeness, string>>({
    polite: '',
    assertive: '',
  });
  const timers = useRef<Partial<Record<Politeness, ReturnType<typeof setTimeout>>>>({});

  const announce = useCallback<Announce>((message, politeness = 'polite') => {
    // Clear first so repeating the same message is announced again.
    setMessages((current) => ({ ...current, [politeness]: '' }));
    clearTimeout(timers.current[politeness]);
    timers.current[politeness] = setTimeout(
      () => setMessages((current) => ({ ...current, [politeness]: message })),
      RESET_MS,
    );
  }, []);

  const value = useMemo(() => announce, [announce]);

  return (
    <AnnounceContext.Provider value={value}>
      {children}
      <VisuallyHidden>
        <span role="status" aria-live="polite" aria-atomic="true">
          {messages.polite}
        </span>
        <span role="alert" aria-live="assertive" aria-atomic="true">
          {messages.assertive}
        </span>
      </VisuallyHidden>
    </AnnounceContext.Provider>
  );
};

/** Returns announce(message, politeness). Use 'assertive' only for urgent messages, e.g. alarms. */
export const useAnnounce = (): Announce => {
  const announce = useContext(AnnounceContext);
  if (!announce) {
    throw new Error('useAnnounce must be used inside <LiveAnnouncer>');
  }
  return announce;
};
