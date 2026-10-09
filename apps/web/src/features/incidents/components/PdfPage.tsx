'use client';

import { Box } from '@mui/material';
import type { PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import { loadPdfjs } from '../pdf/pdfjs';

export interface PageSize {
  width: number;
  height: number;
}

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  /** Size at scale 1, until the page itself is loaded (the first page's size). */
  estimate: PageSize;
  /** The scroll container: pages render when they come near its viewport. */
  root: HTMLElement | null;
  label: string;
  /** Search term to highlight in the text layer, and which of this page's hits is current. */
  query: string;
  activeHit: number | null;
}

/**
 * One page: a canvas, plus pdf.js's transparent text layer on top, so text can be selected,
 * searched and read by screen readers. Draws only once it is near the visible area.
 */
export const PdfPage = ({
  doc,
  pageNumber,
  scale,
  estimate,
  root,
  label,
  query,
  activeHit,
}: PdfPageProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState<PageSize>(estimate);
  const [textLayer, setTextLayer] = useState<TextLayer | null>(null);

  // Start drawing when the page comes within a screen of the visible area; keep it drawn after.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || visible) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setVisible(true),
      { root, rootMargin: '100% 0px' },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [root, visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let layer: TextLayer | undefined;

    void (async () => {
      const [pdfjs, page] = await Promise.all([loadPdfjs(), doc.getPage(pageNumber)]);
      const canvas = canvasRef.current;
      const text = textRef.current;
      if (cancelled || !canvas || !text) return;
      const base = page.getViewport({ scale: 1 });
      setSize({ width: base.width, height: base.height });
      const viewport = page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      renderTask = page.render({
        canvas,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      text.replaceChildren();
      layer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: text,
        viewport,
      });
      await Promise.all([renderTask.promise, layer.render()]);
      if (!cancelled) setTextLayer(layer);
    })().catch((error: unknown) => {
      // A newer render (zoom) cancels this one.
      if (!(error instanceof Error && error.name === 'RenderingCancelledException') && !cancelled) {
        console.error(error);
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      layer?.cancel();
      setTextLayer(null);
    };
  }, [doc, pageNumber, scale, visible]);

  // Highlight hits in the text layer and bring the current one into view.
  useEffect(() => {
    if (!textLayer) return;
    const needle = query.trim().toLowerCase();
    let hit = 0;
    let active: HTMLElement | undefined;
    textLayer.textDivs.forEach((div, index) => {
      const matches =
        needle !== '' && textLayer.textContentItemsStr[index]?.toLowerCase().includes(needle);
      div.classList.toggle('hit', Boolean(matches));
      div.classList.toggle('active', Boolean(matches) && hit === activeHit);
      if (matches && hit === activeHit) active = div;
      if (matches) hit += 1;
    });
    active?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [textLayer, query, activeHit]);

  const width = size.width * scale;
  const height = size.height * scale;

  return (
    <Box
      ref={boxRef}
      role="group"
      aria-label={label}
      data-page-number={pageNumber}
      data-rendered={textLayer ? 'true' : undefined}
      sx={{
        position: 'relative',
        width,
        height,
        mx: 'auto',
        bgcolor: 'common.white',
        boxShadow: 1,
        flexShrink: 0,
        // pdf.js sizes the text layer from these variables.
        '--total-scale-factor': scale,
        '--scale-round-x': '1px',
        '--scale-round-y': '1px',
      }}
    >
      <Box
        component="canvas"
        ref={canvasRef}
        aria-hidden
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <Box
        ref={textRef}
        className="textLayer"
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'clip',
          lineHeight: 1,
          textAlign: 'initial',
          transformOrigin: '0 0',
          forcedColorAdjust: 'none',
          '--min-font-size': 1,
          '--text-scale-factor': 'calc(var(--total-scale-factor) * var(--min-font-size))',
          '--min-font-size-inv': 'calc(1 / var(--min-font-size))',
          '& :is(span, br)': {
            color: 'transparent',
            position: 'absolute',
            whiteSpace: 'pre',
            cursor: 'text',
            transformOrigin: '0% 0%',
          },
          '& > :not(.markedContent), & .markedContent span:not(.markedContent)': {
            '--font-height': 0,
            '--scale-x': 1,
            '--rotate': '0deg',
            fontSize: 'calc(var(--text-scale-factor) * var(--font-height))',
            transform:
              'rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))',
          },
          '& .markedContent': { display: 'contents' },
          '& ::selection': { bgcolor: 'primary.main', color: 'transparent', opacity: 0.3 },
          '& .hit': { bgcolor: 'warning.main', opacity: 0.35, borderRadius: 0.5 },
          '& .hit.active': { opacity: 0.6, outline: 2, outlineColor: 'warning.dark' },
          '& .endOfContent': { display: 'block', position: 'absolute', inset: '100% 0 0' },
        }}
      />
    </Box>
  );
};
