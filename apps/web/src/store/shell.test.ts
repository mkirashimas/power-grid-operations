import { describe, expect, it } from 'vitest';
import { makeStore } from './index';
import {
  closeHelp,
  initialShellState,
  openHelp,
  selectHelpOpen,
  selectSidebarCollapsed,
  selectSidebarRail,
  toggleSidebar,
} from './shellSlice';

describe('shell slice', () => {
  it('folds the sidebar while help is open and restores it on close', () => {
    const store = makeStore();
    store.dispatch(openHelp());
    expect(selectHelpOpen(store.getState())).toBe(true);
    expect(selectSidebarRail(store.getState())).toBe(true);
    expect(selectSidebarCollapsed(store.getState())).toBe(false);

    store.dispatch(closeHelp());
    expect(selectSidebarRail(store.getState())).toBe(false);
  });

  it("keeps the user's collapsed sidebar collapsed after help closes", () => {
    const store = makeStore({ shell: { ...initialShellState, sidebarCollapsed: true } });
    store.dispatch(openHelp());
    store.dispatch(closeHelp());
    expect(selectSidebarRail(store.getState())).toBe(true);
  });

  it('expands a rail that help folded, and keeps it expanded after help closes', () => {
    const store = makeStore();
    store.dispatch(openHelp());
    store.dispatch(toggleSidebar());
    expect(selectSidebarRail(store.getState())).toBe(false);

    store.dispatch(closeHelp());
    expect(selectSidebarRail(store.getState())).toBe(false);
    expect(selectSidebarCollapsed(store.getState())).toBe(false);
  });

  it('collapses and expands on toggle', () => {
    const store = makeStore();
    store.dispatch(toggleSidebar());
    expect(selectSidebarCollapsed(store.getState())).toBe(true);
    store.dispatch(toggleSidebar());
    expect(selectSidebarCollapsed(store.getState())).toBe(false);
  });
});
