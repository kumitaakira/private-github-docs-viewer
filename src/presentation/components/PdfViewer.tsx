import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { useEffect, useMemo, useRef, useState } from 'react';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

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

  if (!pdf) {
    return <div className="p-6 text-sm text-gray-500 dark:text-dracula-comment">PDFを準備しています...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[600px] space-y-3 py-4" style={{ width: `${zoom}%` }}>
      <div className="sticky top-2 z-10 mx-auto flex w-fit items-center gap-1 rounded border border-gray-200 bg-white/90 p-1 text-sm shadow-sm backdrop-blur dark:border-dracula-current dark:bg-dracula-sidebar/90">
        <button
          className="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-dracula-current"
          onClick={() => setZoom((value) => Math.max(50, value - 25))}
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
          onClick={() => setZoom((value) => Math.min(300, value + 25))}
          type="button"
        >
          +
        </button>
      </div>
      {Array.from({ length: pdf.numPages }, (_, index) => (
        <PdfPage key={index + 1} pageNumber={index + 1} pdf={pdf} zoom={zoom} />
      ))}
    </div>
  );
}
