"use client";

import { useEffect, useRef, useState } from "react";
import type * as PdfJs from "pdfjs-dist";

type PdfJsModule = typeof PdfJs;

/**
 * In-app PDF reader. Pages render to canvas — the browser's native viewer
 * (with its download button) never appears. Content is fetched through the
 * authenticated /api/documents endpoint with the session cookie.
 */
export function PdfReader({ documentId, title }: { documentId: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfjsRef = useRef<PdfJsModule | null>(null);
  const docRef = useRef<PdfJs.PDFDocumentProxy | null>(null);
  const taskRef = useRef<PdfJs.PDFDocumentLoadingTask | null>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const renderTaskRef = useRef<PdfJs.RenderTask | null>(null);

  // Load the document once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = pdfjsRef.current ?? (await import("pdfjs-dist"));
        pdfjsRef.current = pdfjs;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url: `/api/documents/${documentId}` });
        taskRef.current = task;
        const doc = await task.promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("We couldn't open this document. Please try again.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      taskRef.current?.destroy();
    };
  }, [documentId]);

  // Render the current page.
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || loading) return;

    renderTaskRef.current?.cancel();
    (async () => {
      try {
        const p = await doc.getPage(page);
        const containerWidth = containerRef.current?.clientWidth ?? 800;
        const baseViewport = p.getViewport({ scale: 1 });
        const scale = (containerWidth / baseViewport.width) * zoom;
        const viewport = p.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const task = p.render({ canvas, canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if ((err as { name?: string })?.name !== "RenderingCancelledException") throw err;
      }
    })();
  }, [page, zoom, loading, numPages]);

  async function search() {
    const doc = docRef.current;
    const q = searchQuery.trim().toLowerCase();
    if (!doc || !q) return;
    setSearchBusy(true);
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      const text = await p.getTextContent();
      const pageText = text.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ")
        .toLowerCase();
      if (pageText.includes(q)) {
        setPage(i);
        break;
      }
    }
    setSearchBusy(false);
  }

  const btn =
    "inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-brand-1 hover:text-brand-1 disabled:opacity-40 dark:hover:text-brand-3";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
      {/* Toolbar: page nav, zoom, search — no download */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2.5">
        <span className="mr-auto truncate text-sm font-semibold">{title}</span>
        <div className="flex items-center gap-1.5">
          <button className={btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            ← Prev
          </button>
          <span className="px-1 text-xs font-medium text-text-muted">
            {loading ? "…" : `${page} / ${numPages}`}
          </span>
          <button className={btn} onClick={() => setPage((p) => Math.min(numPages, p + 1))} disabled={page >= numPages}>
            Next →
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button className={btn} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out">
            −
          </button>
          <span className="w-10 text-center text-xs font-medium text-text-muted">{Math.round(zoom * 100)}%</span>
          <button className={btn} onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in">
            +
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search pages…"
            className="w-32 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
          />
          <button className={btn} onClick={search} disabled={searchBusy || !searchQuery.trim()}>
            {searchBusy ? "…" : "Find"}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="max-h-[75vh] overflow-auto p-4">
        {error ? (
          <p className="py-16 text-center text-sm text-text-muted">{error}</p>
        ) : (
          <>
            {loading ? <p className="py-16 text-center text-sm text-text-muted">Opening document…</p> : null}
            <canvas ref={canvasRef} className="mx-auto block max-w-full shadow-sm" />
          </>
        )}
      </div>
    </div>
  );
}
