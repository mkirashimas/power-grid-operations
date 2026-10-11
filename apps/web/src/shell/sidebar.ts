/** Cookie holding the desktop sidebar choice, so the server renders the right width. */
export const SIDEBAR_COOKIE = 'sidebar';

const COLLAPSED = 'collapsed';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const isSidebarCollapsed = (cookieValue: string | undefined | null) =>
  cookieValue === COLLAPSED;

export const persistSidebarCollapsed = (collapsed: boolean) => {
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? COLLAPSED : 'expanded'}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
};
