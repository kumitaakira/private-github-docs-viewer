import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const DESKTOP_BASE_WIDTH = 600;

type PdfViewerProps = {
  bytes: Uint8Array;
};

type PdfPageProps = {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
};

function PdfPage({ pdf, pageNumber, zoom }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    async function render() {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: (zoom / 100) * (window.devicePixelRatio || 1) });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTask = page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport });
      await renderTask.promise;
    }

    render().catch(() => {});
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdf, zoom]);

  return (
    <div className="pdf-page w-full rounded border border-gray-200 bg-white shadow-sm dark:border-dracula-current">
      <canvas ref={canvasRef} />
    </div>
  );
}

export function PdfViewer({ bytes }: PdfViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [zoom, setZoom] = useState(100);
  const data = useMemo(() => bytes.slice(), [bytes]);
  const wheelDeltaRef = useRef(0);

  const changeZoom = useCallback((delta: number) => {
    setZoom((value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value + delta)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = pdfjsLib.getDocument({ data });
    task.promise
      .then((document) => {
        if (!cancelled) setPdf(document);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [data]);

  useEffect(() => {
    function cancelBrowserZoom(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();

      wheelDeltaRef.current += event.deltaY;
      if (Math.abs(wheelDeltaRef.current) < 8) return;

      changeZoom(wheelDeltaRef.current < 0 ? 10 : -10);
      wheelDeltaRef.current = 0;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      if (!['+', '=', '-', '0'].includes(event.key)) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.key === '0') setZoom(100);
      else changeZoom(event.key === '-' ? -25 : 25);
    }

    function cancelGesture(event: Event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const options = { capture: true, passive: false } as AddEventListenerOptions;
    window.addEventListener('wheel', cancelBrowserZoom, options);
    document.addEventListener('wheel', cancelBrowserZoom, options);
    document.addEventListener('keydown', handleKeyDown, options);
    document.addEventListener('gesturestart', cancelGesture, options);
    document.addEventListener('gesturechange', cancelGesture, options);

    return () => {
      window.removeEventListener('wheel', cancelBrowserZoom, options);
      document.removeEventListener('wheel', cancelBrowserZoom, options);
      document.removeEventListener('keydown', handleKeyDown, options);
      document.removeEventListener('gesturestart', cancelGesture, options);
      document.removeEventListener('gesturechange', cancelGesture, options);
    };
  }, [changeZoom]);

  if (!pdf) {
    return <div className="p-6 text-sm text-gray-500 dark:text-dracula-comment">PDFを準備しています...</div>;
  }

  const desktopWidth = Math.round(DESKTOP_BASE_WIDTH * (zoom / 100));

  return (
    <div className="pdf-viewer mx-auto flex min-h-full w-full flex-col items-center space-y-3 overflow-x-auto px-3 py-4">
      <div className="sticky top-3 z-10 mx-auto flex w-fit items-center gap-1 rounded border border-gray-200 bg-white/90 p-1 text-sm shadow-sm backdrop-blur dark:border-dracula-current dark:bg-dracula-sidebar/90">
        <button
          className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-dracula-current"
          onClick={() => changeZoom(-25)}
          type="button"
        >
          -
        </button>
        <button
          className="w-12 rounded px-2 py-1 font-mono hover:bg-gray-100 dark:hover:bg-dracula-current"
          onClick={() => setZoom(100)}
          type="button"
        >
          {zoom}%
        </button>
        <button
          className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-dracula-current"
          onClick={() => changeZoom(25)}
          type="button"
        >
          +
        </button>
      </div>
      <div
        className="pdf-pages space-y-3"
        style={
          {
            '--pdf-desktop-width': `${desktopWidth}px`,
            '--pdf-mobile-width': `${zoom}%`,
          } as CSSProperties
        }
      >
        {Array.from({ length: pdf.numPages }, (_, index) => (
          <PdfPage key={index + 1} pageNumber={index + 1} pdf={pdf} zoom={zoom} />
        ))}
      </div>
    </div>
  );
}
