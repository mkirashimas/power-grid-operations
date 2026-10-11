import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface ShellState {
  /** The section help panel is open. */
  helpOpen: boolean;
  /** The user's own choice for the desktop sidebar, saved in the `sidebar` cookie. */
  sidebarCollapsed: boolean;
  /** Opening help folded the sidebar to its icon rail; closing help unfolds it again. */
  collapsedForHelp: boolean;
}

export const initialShellState: ShellState = {
  helpOpen: false,
  sidebarCollapsed: false,
  collapsedForHelp: false,
};

/**
 * UI state of the app shell (hoc/Layout): the help panel and the sidebar width. A static slice
 * (store/index.ts), so the server can preload the sidebar choice from its cookie.
 */
export const shellSlice = createSlice({
  name: 'shell',
  initialState: initialShellState,
  reducers: {
    openHelp: (state) => {
      state.helpOpen = true;
      state.collapsedForHelp = !state.sidebarCollapsed;
    },
    closeHelp: (state) => {
      state.helpOpen = false;
      state.collapsedForHelp = false;
    },
    /** Expands the rail (whatever folded it) or collapses the full sidebar. */
    toggleSidebar: (state) => {
      const collapsed = state.sidebarCollapsed || state.collapsedForHelp;
      state.sidebarCollapsed = !collapsed;
      state.collapsedForHelp = false;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
  },
  selectors: {
    selectHelpOpen: (state) => state.helpOpen,
    selectSidebarCollapsed: (state) => state.sidebarCollapsed,
    /** What the sidebar shows: the icon rail when the user or the help panel folded it. */
    selectSidebarRail: (state) => state.sidebarCollapsed || state.collapsedForHelp,
  },
});

export const { openHelp, closeHelp, toggleSidebar, setSidebarCollapsed } = shellSlice.actions;
export const { selectHelpOpen, selectSidebarCollapsed, selectSidebarRail } = shellSlice.selectors;
