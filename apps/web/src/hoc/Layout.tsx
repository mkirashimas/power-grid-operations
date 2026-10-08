'use client';

// Per-icon imports: the package index pulls in thousands of modules.
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
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
  useColorScheme,
  type SelectChangeEvent,
} from '@mui/material';
import { IconButton } from '@pgo/ui';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { persistLanguage, toLanguage } from '../i18n/language';
import { LANGUAGES, PATHS, type Language, type Path } from '../types';

const SIDEBAR_WIDTH = 240;
const MAIN_CONTENT_ID = 'main-content';

interface NavItem {
  key: string;
  to: Path;
  icon: ReactNode;
}

// One entry per feature section.
const NAV_ITEMS: NavItem[] = [{ key: 'home', to: PATHS.HOME, icon: <HomeOutlined /> }];

const isSelected = (item: NavItem, pathname: string) =>
  item.to === PATHS.HOME ? pathname === PATHS.HOME : pathname.startsWith(item.to);

const Navigation = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { t } = useTranslation('common');
  const pathname = usePathname();

  return (
    <>
      <Toolbar />
      <Box component="nav" aria-label={t('mainNavigation')} sx={{ p: 1.5 }}>
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {NAV_ITEMS.map((item) => {
            const selected = isSelected(item, pathname);
            return (
              <ListItem key={item.key} disablePadding>
                <ListItemButton
                  component={NextLink}
                  href={item.to}
                  selected={selected}
                  aria-current={selected ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={t(`nav.${item.key}`)} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        </Toolbar>
      </AppBar>

      {/* Desktop: permanent sidebar. Picked with CSS rather than useMediaQuery so the
          server-rendered markup is already right for the viewport. */}
      <Drawer
        variant="permanent"
        sx={(theme) => ({
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, boxSizing: 'border-box' },
          [theme.breakpoints.down('md')]: { display: 'none' },
        })}
      >
        <Navigation />
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
          {children}
        </Container>
      </Box>
    </Box>
  );
};
