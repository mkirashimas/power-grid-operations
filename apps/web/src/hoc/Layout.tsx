'use client';

// Per-icon imports: the package index pulls in thousands of modules.
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import MapOutlined from '@mui/icons-material/MapOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import ReportOutlined from '@mui/icons-material/ReportOutlined';
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined';
import TableRowsOutlined from '@mui/icons-material/TableRowsOutlined';
import {
  AppBar,
  Box,
  Container,
  Drawer,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Tooltip,
  useColorScheme,
  useMediaQuery,
  type SelectChangeEvent,
} from '@mui/material';
import { HelpPanel, IconButton } from '@pgo/ui';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { persistLanguage, toLanguage } from '../i18n/language';
import { LANGUAGES, PATHS, type Language, type Path } from '../types';
import { HELP_PANEL_ID } from '../shell/HelpButton';
import { persistSidebarCollapsed } from '../shell/sidebar';
import { useAppDispatch, useAppSelector } from '../store';
import {
  closeHelp,
  selectHelpOpen,
  selectSidebarCollapsed,
  selectSidebarRail,
  toggleSidebar,
} from '../store/shellSlice';
import { InstallButton, OfflineBanner, UpdatePrompt } from './Pwa';
import { SelectionBar } from './SelectionBar';
import { useSelectionUrlSync } from './useSelectionUrlSync';

const SIDEBAR_WIDTH = 240;
/** Icon-only sidebar: the icon plus its button padding on both sides. */
const RAIL_SPACING = 9;
const MAIN_CONTENT_ID = 'main-content';

interface NavItem {
  key: string;
  to: Path;
  icon: ReactNode;
}

// One entry per feature section.
const NAV_ITEMS: NavItem[] = [
  { key: 'home', to: PATHS.HOME, icon: <HomeOutlined /> },
  { key: 'telemetry', to: PATHS.TELEMETRY, icon: <TableRowsOutlined /> },
  { key: 'charts', to: PATHS.CHARTS, icon: <ShowChartOutlined /> },
  { key: 'alarms', to: PATHS.ALARMS, icon: <NotificationsActiveOutlined /> },
  { key: 'map', to: PATHS.MAP, icon: <MapOutlined /> },
  { key: 'network', to: PATHS.NETWORK, icon: <AccountTreeOutlined /> },
  { key: 'incidents', to: PATHS.INCIDENTS, icon: <ReportOutlined /> },
];

const isSelected = (item: NavItem, pathname: string) =>
  item.to === PATHS.HOME ? pathname === PATHS.HOME : pathname.startsWith(item.to);

/** Order of the blocks in every section's help panel (`help.headings.*`, `help.sections.<key>.*`). */
const HELP_BLOCKS = ['what', 'looking', 'how', 'why'] as const;

interface NavigationProps {
  onNavigate?: () => void;
  /** Icon rail: labels move to tooltips. */
  collapsed?: boolean;
  /** Shows the collapse/expand button (desktop sidebar only). */
  onToggleCollapsed?: () => void;
}

const Navigation = ({ onNavigate, collapsed = false, onToggleCollapsed }: NavigationProps) => {
  const { t } = useTranslation('common');
  const pathname = usePathname();

  return (
    <>
      <Toolbar />
      <Box component="nav" aria-label={t('mainNavigation')} sx={{ p: 1.5 }}>
        {onToggleCollapsed && (
          <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', mb: 0.5 }}>
            <IconButton
              label={t(collapsed ? 'sidebar.expand' : 'sidebar.collapse')}
              tooltipPlacement="right"
              aria-expanded={!collapsed}
              onClick={onToggleCollapsed}
            >
              {collapsed ? <ChevronRightOutlined /> : <ChevronLeftOutlined />}
            </IconButton>
          </Box>
        )}
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {NAV_ITEMS.map((item) => {
            const selected = isSelected(item, pathname);
            const label = t(`nav.${item.key}`);
            return (
              <ListItem key={item.key} disablePadding>
                <Tooltip title={collapsed ? label : ''} placement="right">
                  <ListItemButton
                    component={NextLink}
                    href={item.to}
                    selected={selected}
                    aria-current={selected ? 'page' : undefined}
                    aria-label={collapsed ? label : undefined}
                    onClick={onNavigate}
                    sx={collapsed ? { justifyContent: 'center', px: 1.5 } : undefined}
                  >
                    <ListItemIcon sx={collapsed ? { minWidth: 0 } : undefined}>
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && <ListItemText primary={label} />}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </>
  );
};

/** Plain-language help for the current section: a side panel on desktop, a sheet on phones. */
const SectionHelp = () => {
  const { t } = useTranslation('common');
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectHelpOpen);
  // A behaviour switch, not styling: the panel is closed in the server markup either way.
  const phone = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const item = NAV_ITEMS.find((navItem) => isSelected(navItem, pathname));

  if (!item) {
    return null;
  }

  return (
    <HelpPanel
      id={HELP_PANEL_ID}
      open={open}
      onClose={() => dispatch(closeHelp())}
      variant={phone ? 'sheet' : 'side'}
      title={t('help.title', { section: t(`nav.${item.key}`) })}
      closeLabel={t('help.close')}
      sections={HELP_BLOCKS.map((block) => ({
        heading: t(`help.headings.${block}`),
        body: t(`help.sections.${item.key}.${block}`),
      }))}
    />
  );
};

const ThemeModeToggle = () => {
  const { t } = useTranslation('common');
  const { mode, systemMode, setMode } = useColorScheme();
  // `mode` is undefined until the client has read the stored choice.
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const label = t(resolvedMode === 'dark' ? 'theme.switchToLight' : 'theme.switchToDark');

  return (
    <IconButton
      label={label}
      color="inherit"
      onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
    >
      {/* Both icons render; CSS picks one, so the server markup is right for either scheme. */}
      <DarkModeOutlined sx={(theme) => theme.applyStyles('dark', { display: 'none' })} />
      <LightModeOutlined
        sx={(theme) => ({ display: 'none', ...theme.applyStyles('dark', { display: 'block' }) })}
      />
    </IconButton>
  );
};

const LanguageSelect = () => {
  const { t, i18n } = useTranslation('common');
  const router = useRouter();

  const handleChange = (event: SelectChangeEvent<Language>) => {
    const language = toLanguage(event.target.value);
    persistLanguage(language);
    void i18n.changeLanguage(language);
    // Re-render server components in the new language.
    router.refresh();
  };

  return (
    <Select
      value={toLanguage(i18n.resolvedLanguage)}
      onChange={handleChange}
      variant="standard"
      disableUnderline
      renderValue={(language) => (
        <>
          <Box
            component="span"
            sx={(theme) => ({ [theme.breakpoints.down('sm')]: { display: 'none' } })}
          >
            {t(`languages.${language}`)}
          </Box>
          <Box
            component="span"
            sx={(theme) => ({
              display: 'none',
              [theme.breakpoints.down('sm')]: { display: 'inline' },
            })}
          >
            {language.toUpperCase()}
          </Box>
        </>
      )}
      inputProps={{ 'aria-label': t('language') }}
      sx={{ color: 'inherit', '& .MuiSvgIcon-root': { color: 'inherit' } }}
    >
      {LANGUAGES.map((language) => (
        <MenuItem key={language} value={language} lang={language}>
          {t(`languages.${language}`)}
        </MenuItem>
      ))}
    </Select>
  );
};

export const Layout = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation('common');
  useSelectionUrlSync();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dispatch = useAppDispatch();
  const rail = useAppSelector(selectSidebarRail);
  const sidebarCollapsed = useAppSelector(selectSidebarCollapsed);

  // The cookie lets the server render the sidebar at the right width (app/layout.tsx).
  useEffect(() => {
    persistSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      <Link
        href={`#${MAIN_CONTENT_ID}`}
        sx={(theme) => ({
          position: 'absolute',
          left: theme.spacing(2),
          top: theme.spacing(-10),
          zIndex: theme.zIndex.tooltip,
          p: 1,
          bgcolor: 'background.paper',
          '&:focus': { top: theme.spacing(1) },
        })}
      >
        {t('skipToContent')}
      </Link>

      <AppBar sx={(theme) => ({ zIndex: theme.zIndex.drawer + 1 })}>
        <Toolbar
          sx={(theme) => ({
            gap: 2,
            [theme.breakpoints.down('sm')]: { gap: 1 },
          })}
        >
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setSidebarOpen((open) => !open)}
            label={t('openMenu')}
            aria-expanded={sidebarOpen}
            sx={(theme) => ({
              display: 'none',
              [theme.breakpoints.down('md')]: { display: 'inline-flex' },
            })}
          >
            <MenuIcon />
          </IconButton>

          <Link
            component={NextLink}
            href={PATHS.HOME}
            color="inherit"
            underline="none"
            variant="h6"
            noWrap
            sx={{ flexGrow: 1, minWidth: 0 }}
          >
            {t('appName')}
          </Link>

          <LanguageSelect />
          <ThemeModeToggle />
          <InstallButton />
        </Toolbar>
      </AppBar>

      {/* Desktop: permanent sidebar. Picked with CSS rather than useMediaQuery so the
          server-rendered markup is already right for the viewport. */}
      <Drawer
        variant="permanent"
        sx={(theme) => {
          const width = rail ? theme.spacing(RAIL_SPACING) : `${SIDEBAR_WIDTH}px`;
          const transition = theme.transitions.create('width', {
            duration: theme.transitions.duration.enteringScreen,
          });
          return {
            width,
            flexShrink: 0,
            transition,
            '& .MuiDrawer-paper': {
              width,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              transition,
            },
            [theme.breakpoints.down('md')]: { display: 'none' },
          };
        }}
      >
        <Navigation collapsed={rail} onToggleCollapsed={() => dispatch(toggleSidebar())} />
      </Drawer>

      {/* Mobile: temporary sidebar opened from the menu button. */}
      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={(theme) => ({
          display: 'none',
          '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, boxSizing: 'border-box' },
          [theme.breakpoints.down('md')]: { display: 'block' },
        })}
      >
        <Navigation onNavigate={() => setSidebarOpen(false)} />
      </Drawer>

      <Box component="main" id={MAIN_CONTENT_ID} tabIndex={-1} sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        <Container
          sx={(theme) => ({
            py: 4,
            [theme.breakpoints.down('md')]: { py: 2, px: 2 },
          })}
        >
          <OfflineBanner />
          <SelectionBar />
          {children}
        </Container>
      </Box>

      <SectionHelp />
      <UpdatePrompt />
    </Box>
  );
};
