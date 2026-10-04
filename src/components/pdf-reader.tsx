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
  const wrapperRef = useRef<HTMLDivElement>(null);
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
  const [fullscreen, setFullscreen] = useState(false);
  /** Bumped to re-fit the page when the reader's box changes size. */
  const [fitTick, setFitTick] = useState(0);
  const renderTaskRef = useRef<PdfJs.RenderTask | null>(null);

  // Track the real fullscreen state so the button stays correct when the user
  // leaves fullscreen with Esc or the browser's own control.
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Re-fit when the reader's box changes size — entering fullscreen, resizing
  // the window, or rotating a device. Without this the page keeps the scale it
  // was first rendered at and no longer fills the space.
  useEffect(() => {
    const box = containerRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    let last = 0;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      const area = Math.round(r.width) * Math.round(r.height);
      // Ignore sub-pixel churn; only re-render on a meaningful change.
      if (Math.abs(area - last) < 4000) return;
      last = area;
      setFitTick((t) => t + 1);
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapperRef.current?.requestFullscreen();
    } catch {
      // Some browsers refuse fullscreen outside a user gesture; the layout below
      // still fills the viewport, so this is not fatal.
    }
  }

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
        const base = p.getViewport({ scale: 1 });
        const box = containerRef.current;
        // The scroll container carries p-4, so the usable box is inset 16px a
        // side. Fit the WHOLE page, not just its width: a portrait page scaled
        // to the reader's width is far taller than the reader, so only the top
        // of it was ever visible. Fitting both axes shows the full page, and
        // zoom then enlarges from there.
        const availW = Math.max(120, (box?.clientWidth ?? 800) - 32);
        const availH = Math.max(120, (box?.clientHeight ?? 600) - 32);
        const fit = Math.min(availW / base.width, availH / base.height);
        const viewport = p.getViewport({ scale: fit * zoom });
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
  }, [page, zoom, loading, numPages, fullscreen, fitTick]);

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

  // The reader fills the page rather than sitting in a small box. The height is
  // the viewport minus the surrounding chrome (shell padding, the breadcrumb,
  // the caption below, and on mobile the header and nav strip). Mobile carries
  // more chrome, hence the larger offset. dvh rather than vh so mobile browser
  // toolbars don't clip the bottom.
  const shellClass = fullscreen
    ? "flex h-screen w-screen flex-col overflow-hidden bg-surface-2"
    : "flex h-[calc(100dvh-15rem)] min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-surface-2 md:h-[calc(100dvh-10rem)]";

  return (
    <div ref={wrapperRef} className={shellClass}>
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
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="Fit the page to the reader"
            className="w-12 text-center text-xs font-medium text-text-muted hover:text-brand-1 dark:hover:text-brand-3"
          >
            {zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`}
          </button>
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
        <button
          className={btn}
          onClick={toggleFullscreen}
          aria-pressed={fullscreen}
          aria-label={fullscreen ? "Exit full screen" : "Read in full screen"}
          title={fullscreen ? "Exit full screen" : "Read in full screen"}
        >
          {fullscreen ? "⤡ Exit full screen" : "⛶ Full screen"}
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-surface-2 p-4"
      >
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
