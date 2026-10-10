import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIos, useInstallPrompt, type BeforeInstallPromptEvent } from './useInstallPrompt';

const promptEvent = () => {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  event.prompt = vi.fn(() => Promise.resolve());
  return event;
};

const runningStandalone = (matches: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: matches && query === '(display-mode: standalone)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';

describe('useInstallPrompt', () => {
  afterEach(() => vi.restoreAllMocks());

  it('offers the browser prompt once it fires, and only once', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);

    const event = promptEvent();
    act(() => void window.dispatchEvent(event));
    // The mini-infobar is suppressed; the top-bar button offers the install.
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.canInstall).toBe(true);

    await act(() => result.current.install());
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(result.current.canInstall).toBe(false);
  });

  it('forgets the prompt once the app is installed', () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => void window.dispatchEvent(promptEvent()));
    act(() => void window.dispatchEvent(new Event('appinstalled')));
    expect(result.current.canInstall).toBe(false);
  });

  it('offers nothing when already running installed', () => {
    runningStandalone(true);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    const { result } = renderHook(() => useInstallPrompt());
    act(() => void window.dispatchEvent(promptEvent()));
    expect(result.current).toMatchObject({ canInstall: false, showIosHint: false });
  });

  it('shows the Add to Home Screen hint on iOS', () => {
    runningStandalone(false);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.showIosHint).toBe(true);
  });
});

describe('isIos', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'maxTouchPoints');
  });

  // jsdom has no maxTouchPoints.
  const touchPoints = (value: number) =>
    Object.defineProperty(navigator, 'maxTouchPoints', { value, configurable: true });

  it('recognises iPadOS, which reports a Mac with touch', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel)');
    touchPoints(5);
    expect(isIos()).toBe(true);
    touchPoints(0);
    expect(isIos()).toBe(false);
  });
});
