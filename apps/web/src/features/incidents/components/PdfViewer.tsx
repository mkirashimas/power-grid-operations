'use client';

import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import FitScreenOutlined from '@mui/icons-material/FitScreenOutlined';
import NavigateBeforeOutlined from '@mui/icons-material/NavigateBeforeOutlined';
import NavigateNextOutlined from '@mui/icons-material/NavigateNextOutlined';
import ZoomInOutlined from '@mui/icons-material/ZoomInOutlined';
import ZoomOutOutlined from '@mui/icons-material/ZoomOutOutlined';
import { Alert, Box, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { FilterField, IconButton, Toolbar, useAnnounce } from '@pgo/ui';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INCIDENTS_NAMESPACE } from '../i18n';
import type { Attachment } from '../model';
import { extractText, loadPdfjs, MissingFileError, openPdf, readAttachment } from '../pdf/pdfjs';
import { findMatches, MIN_QUERY_LENGTH, stepMatch, type TextMatch } from '../pdf/search';
import { PdfPage, type PageSize } from './PdfPage';

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
// Room for the page shadow and the scrollbar when fitting to width.
const FIT_MARGIN_PX = 32;

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; doc: PDFDocumentProxy; size: PageSize }
  | { status: 'error' | 'missing' };

interface PdfViewerProps {
  attachment: Attachment;
  /** The page to open at (from the URL); later page changes are reported with onPageChange. */
  initialPage: number;
  onPageChange: (page: number) => void;
  onClose: () => void;
}

/** pdf.js viewer: lazily drawn pages, page navigation, zoom, fit to width and text search. */
export const PdfViewer = ({ attachment, initialPage, onPageChange, onClose }: PdfViewerProps) => {
  const { t } = useTranslation(INCIDENTS_NAMESPACE);
  const announce = useAnnounce();
  const hintId = useId();
  // The viewer is keyed by attachment, so it starts loading on mount.
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const attachScroller = useCallback((element: HTMLDivElement | null) => {
    scrollerRef.current = element;
    setScroller(element);
  }, []);
  const [scale, setScale] = useState<number | 'fit'>('fit');
  const [containerWidth, setContainerWidth] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [query, setQuery] = useState('');
  const [pageTexts, setPageTexts] = useState<string[][] | null>(null);
  // The chosen match, for the results it was chosen from (new results start at the first).
  const [chosen, setChosen] = useState<{ matches: TextMatch[]; index: number } | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  // Load the file and open it.
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof openPdf> | undefined;
    void (async () => {
      try {
        const [pdfjs, data] = await Promise.all([loadPdfjs(), readAttachment(attachment)]);
        task = openPdf(pdfjs, data);
        const doc = await task.promise;
        const first = (await doc.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        setState({ status: 'ready', doc, size: { width: first.width, height: first.height } });
      } catch (error) {
        if (!cancelled)
          setState({ status: error instanceof MissingFileError ? 'missing' : 'error' });
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [attachment]);

  // Fit to width follows the container.
  useEffect(() => {
    if (!scroller || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scroller]);

  const doc = state.status === 'ready' ? state.doc : null;
  const numPages = doc?.numPages ?? 0;
  const baseWidth = state.status === 'ready' ? state.size.width : 0;
  const fitScale =
    containerWidth && baseWidth
      ? Math.max(0.25, Math.min(3, (containerWidth - FIT_MARGIN_PX) / baseWidth))
      : 1;
  const actualScale = scale === 'fit' ? fitScale : scale;

  /** Scrolls a page to the top of the viewer; the scroll listener then updates `page`. */
  const scrollToPage = useCallback((pageNumber: number) => {
    const element = scrollerRef.current;
    const target = element?.querySelector<HTMLElement>(`[data-page-number="${pageNumber}"]`);
    // Pages are positioned in the scroller, so offsetTop is relative to it.
    if (element && target) element.scrollTop = target.offsetTop;
  }, []);

  const goToPage = (pageNumber: number) => {
    const target = Math.min(Math.max(1, pageNumber), numPages || 1);
    scrollToPage(target);
    setPage(target);
    setPageInput(String(target));
  };

  // Open at the page from the URL once the pages are laid out.
  useEffect(() => {
    if (!doc || !scroller) return;
    const target = Math.min(initialPage, doc.numPages);
    if (target > 1) requestAnimationFrame(() => scrollToPage(target));
    announce(t('viewer.pageLabel', { page: target, count: doc.numPages }));
    // Only when a document opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, scroller]);

  // The current page is the one covering the middle of the viewport.
  useEffect(() => {
    if (!doc || !scroller) return;
    const update = () => {
      const middle = scroller.scrollTop + scroller.clientHeight / 2;
      const pages = scroller.querySelectorAll<HTMLElement>('[data-page-number]');
      let current = 1;
      pages.forEach((element) => {
        if (element.offsetTop <= middle) current = Number(element.dataset.pageNumber);
      });
      setPage(current);
      setPageInput(String(current));
    };
    scroller.addEventListener('scroll', update, { passive: true });
    return () => scroller.removeEventListener('scroll', update);
  }, [doc, scroller]);

  useEffect(() => {
    if (doc) onPageChangeRef.current(page);
  }, [doc, page]);

  // Search: extract the text once, on the first query.
  useEffect(() => {
    if (!doc || pageTexts || query.trim().length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    extractText(doc)
      .then((texts) => !cancelled && setPageTexts(texts))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [doc, pageTexts, query]);

  const matches = useMemo(() => findMatches(pageTexts ?? [], query), [pageTexts, query]);
  const matchIndex = chosen?.matches === matches ? chosen.index : matches.length ? 0 : -1;
  const activeMatch = matchIndex >= 0 ? matches[matchIndex] : undefined;
  const searching = query.trim().length >= MIN_QUERY_LENGTH;

  // New results: announce them.
  useEffect(() => {
    if (!searching || !pageTexts) return;
    announce(
      matches.length
        ? t('viewer.matches', { current: 1, count: matches.length })
        : t('viewer.noMatches'),
    );
    // Only when the results change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  // A drawn page scrolls its current hit into view itself; a page not drawn yet is brought into
  // view first, so it draws and then scrolls to the hit.
  useEffect(() => {
    if (!activeMatch) return;
    const element = scrollerRef.current?.querySelector<HTMLElement>(
      `[data-page-number="${activeMatch.page}"]`,
    );
    if (element?.dataset.rendered !== 'true') scrollToPage(activeMatch.page);
  }, [activeMatch, scrollToPage]);

  const stepTo = (direction: 1 | -1) => {
    const next = stepMatch(matches.length, matchIndex, direction);
    setChosen({ matches, index: next });
    if (next >= 0) announce(t('viewer.matches', { current: next + 1, count: matches.length }));
  };

  /** Which hit on `pageNumber` is the current match (its order among that page's hits). */
  const activeHitOn = (pageNumber: number) => {
    if (!activeMatch || activeMatch.page !== pageNumber) return null;
    return matches.slice(0, matchIndex).filter((match) => match.page === pageNumber).length;
  };

  const zoom = (direction: 1 | -1) => {
    const steps = direction === 1 ? ZOOM_STEPS : [...ZOOM_STEPS].reverse();
    const next =
      steps.find((step) =>
        direction === 1 ? step > actualScale + 0.01 : step < actualScale - 0.01,
      ) ?? steps[steps.length - 1];
    setScale(next);
    // Keep the current page in view at the new size.
    requestAnimationFrame(() => scrollToPage(page));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault();
      goToPage(page + (event.key === 'PageDown' ? 1 : -1));
    }
  };

  const submitPage = () => {
    const value = Number(pageInput);
    if (Number.isInteger(value)) goToPage(value);
    else setPageInput(String(page));
  };

  return (
    <Stack spacing={1.5} data-testid="pdf-viewer">
      <Toolbar label={t('viewer.toolbar')}>
        <IconButton
          label={t('viewer.previous')}
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          <NavigateBeforeOutlined />
        </IconButton>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            size="small"
            label={t('viewer.page')}
            value={pageInput}
            disabled={!doc}
            onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ''))}
            onBlur={submitPage}
            onKeyDown={(event) => event.key === 'Enter' && submitPage()}
            slotProps={{ htmlInput: { inputMode: 'numeric', size: 3 } }}
            sx={{ width: 72 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {t('viewer.pageOf', { count: numPages })}
          </Typography>
        </Stack>
        <IconButton
          label={t('viewer.next')}
          disabled={page >= numPages}
          onClick={() => goToPage(page + 1)}
        >
          <NavigateNextOutlined />
        </IconButton>
        <IconButton
          label={t('viewer.zoomOut')}
          disabled={!doc || actualScale <= ZOOM_STEPS[0]}
          onClick={() => zoom(-1)}
        >
          <ZoomOutOutlined />
        </IconButton>
        <Typography
          variant="body2"
          sx={{ minWidth: '5ch', textAlign: 'center' }}
          data-testid="pdf-zoom"
        >
          {t('viewer.zoom', { percent: Math.round(actualScale * 100) })}
        </Typography>
        <IconButton
          label={t('viewer.zoomIn')}
          disabled={!doc || actualScale >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
          onClick={() => zoom(1)}
        >
          <ZoomInOutlined />
        </IconButton>
        <IconButton
          label={t('viewer.fitWidth')}
          disabled={!doc}
          aria-pressed={scale === 'fit'}
          onClick={() => setScale('fit')}
        >
          <FitScreenOutlined />
        </IconButton>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton label={t('viewer.close')} onClick={onClose}>
          <CloseOutlined />
        </IconButton>
      </Toolbar>

      <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <FilterField
          label={t('viewer.search')}
          placeholder={t('viewer.searchPlaceholder')}
          clearLabel={t('viewer.clearSearch')}
          value={query}
          onChange={setQuery}
        />
        {searching && pageTexts && (
          <>
            <Typography variant="body2" color="text.secondary" data-testid="pdf-matches">
              {matches.length
                ? t('viewer.matches', { current: matchIndex + 1, count: matches.length })
                : t('viewer.noMatches')}
            </Typography>
            <IconButton
              label={t('viewer.previousMatch')}
              disabled={!matches.length}
              onClick={() => stepTo(-1)}
            >
              <ExpandLessOutlined />
            </IconButton>
            <IconButton
              label={t('viewer.nextMatch')}
              disabled={!matches.length}
              onClick={() => stepTo(1)}
            >
              <ExpandMoreOutlined />
            </IconButton>
          </>
        )}
      </Stack>

      <Typography id={hintId} variant="caption" color="text.secondary">
        {t('viewer.hint')}
      </Typography>

      {state.status === 'error' && <Alert severity="error">{t('viewer.error')}</Alert>}
      {state.status === 'missing' && <Alert severity="warning">{t('viewer.missing')}</Alert>}

      <Box
        ref={attachScroller}
        role="region"
        aria-label={t('viewer.label', { name: attachment.name })}
        aria-describedby={hintId}
        aria-busy={state.status === 'loading'}
        tabIndex={0}
        onKeyDown={onKeyDown}
        data-testid="pdf-pages"
        sx={(theme) => ({
          position: 'relative',
          height: '70vh',
          overflow: 'auto',
          bgcolor: 'action.hover',
          borderRadius: 1,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
          [theme.breakpoints.down('md')]: { height: '60vh', p: 1 },
        })}
      >
        {state.status === 'loading' && (
          <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
            <CircularProgress size={28} aria-hidden />
            <Typography variant="body2" color="text.secondary">
              {t('viewer.loading')}
            </Typography>
          </Stack>
        )}
        {state.status === 'ready' &&
          Array.from({ length: state.doc.numPages }, (_, index) => (
            <PdfPage
              key={index + 1}
              doc={state.doc}
              pageNumber={index + 1}
              scale={actualScale}
              estimate={state.size}
              root={scroller}
              label={t('viewer.pageLabel', { page: index + 1, count: state.doc.numPages })}
              query={searching ? query : ''}
              activeHit={activeHitOn(index + 1)}
            />
          ))}
      </Box>
    </Stack>
  );
};
