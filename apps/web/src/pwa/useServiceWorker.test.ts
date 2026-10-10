import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useServiceWorker } from './useServiceWorker';

type Listener = () => void;

/** Just enough of @serwist/window's Serwist to drive the hook. */
const { instances, FakeSerwist } = vi.hoisted(() => {
  const created: InstanceType<typeof Fake>[] = [];
  class Fake {
    listeners = new Map<string, Listener>();
    register = vi.fn(() => Promise.resolve(undefined));
    messageSkipWaiting = vi.fn();
    constructor(
      public url: string,
      public options: RegistrationOptions,
    ) {
      created.push(this);
    }
    addEventListener(type: string, listener: Listener) {
      this.listeners.set(type, listener);
    }
    removeEventListener(type: string) {
      this.listeners.delete(type);
    }
    emit(type: string) {
      this.listeners.get(type)?.();
    }
  }
  return { instances: created, FakeSerwist: Fake };
});

vi.mock('@serwist/window', () => ({ Serwist: FakeSerwist }));

describe('useServiceWorker', () => {
  const reload = vi.fn();

  beforeEach(() => {
    instances.length = 0;
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    vi.stubGlobal('location', { ...window.location, reload });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    reload.mockReset();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  const latest = () => {
    const serwist = instances.at(-1);
    if (!serwist) throw new Error('No service worker was registered');
    return serwist;
  };

  it('does nothing unless enabled (development builds)', () => {
    renderHook(() => useServiceWorker({ enabled: false }));
    expect(instances).toHaveLength(0);
  });

  it('registers the module service worker for the whole app', () => {
    renderHook(() => useServiceWorker({ enabled: true }));
    expect(latest()).toMatchObject({
      url: '/serwist/sw.js',
      options: { scope: '/', type: 'module' },
    });
    expect(latest().register).toHaveBeenCalled();
  });

  it('offers a waiting update and reloads only after the user applies it', () => {
    const { result } = renderHook(() => useServiceWorker({ enabled: true }));
    const serwist = latest();
    expect(result.current.updateReady).toBe(false);

    act(() => serwist.emit('waiting'));
    expect(result.current.updateReady).toBe(true);

    // A new version taking over (e.g. from another tab) does not reload this page by itself.
    serwist.emit('controlling');
    expect(reload).not.toHaveBeenCalled();

    act(() => result.current.applyUpdate());
    expect(serwist.messageSkipWaiting).toHaveBeenCalled();
    serwist.emit('controlling');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('can be dismissed', () => {
    const { result } = renderHook(() => useServiceWorker({ enabled: true }));
    act(() => latest().emit('waiting'));
    act(() => result.current.dismissUpdate());
    expect(result.current.updateReady).toBe(false);
  });
});
