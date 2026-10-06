"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type * as PdfJs from "pdfjs-dist";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCollapse,
  IconExpand,
  IconSearch,
  IconZoomIn,
  IconZoomOut,
} from "@/components/icons";

type PdfJsModule = typeof PdfJs;

/** How long the floating controls stay up after the last interaction. */
const CONTROLS_IDLE_MS = 2600;
/** A swipe must travel this far horizontally, and stay mostly horizontal. */
const SWIPE_MIN_PX = 56;

export type ReaderNeighbour = { href: string; title: string };

/**
 * In-app PDF reader. Pages render to canvas — the browser's native viewer
 * (with its download button) never appears. Content is fetched through the
 * authenticated /api/documents endpoint with the session cookie.
 *
 * Reading is immersive: the content box can fill the screen on its own, with the
 * controls floating over it and fading out, and pages turn by swipe so a phone
 * reads like a book. Swiping past either end moves to the next or previous
 * document in the lesson when one exists.
 */
export function PdfReader({
  documentId,
  title,
  prev,
  next,
}: {
  documentId: string;
  title: string;
  prev?: ReaderNeighbour | null;
  next?: ReaderNeighbour | null;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfjsRef = useRef<PdfJsModule | null>(null);
  const docRef = useRef<PdfJs.PDFDocumentProxy | null>(null);
  const taskRef = useRef<PdfJs.PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<PdfJs.RenderTask | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  /** Whether the content box should fill the screen. */
  const [immersive, setImmersive] = useState(false);
  /** Controls float over the content when immersive; they fade out when idle. */
  const [controlsVisible, setControlsVisible] = useState(true);
  /** Bumped to re-fit the page when the reader's box changes size. */
  const [fitTick, setFitTick] = useState(0);

  // Leaving fullscreen with Esc (or the browser's own control) must drop the
  // immersive layout too, or the page would stay stuck over the whole viewport.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
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

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_IDLE_MS);
  }, []);

  // Clear the idle timer if the reader unmounts mid-fade.
  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  async function toggleImmersive() {
    if (immersive) {
      setImmersive(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      return;
    }
    setImmersive(true);
    // Start the fade timer here rather than in an effect, so the controls are
    // visible on entry and then get out of the way.
    showControls();
    // The layout fills the viewport on its own, so a browser refusing fullscreen
    // (no user gesture, iOS Safari on some versions) is not fatal.
    await containerRef.current?.requestFullscreen?.().catch(() => {});
  }

  /** Turn the page, or leave for the neighbouring document at either end. */
  const advance = useCallback(
    (dir: 1 | -1) => {
      // Until the page count is known there is nothing to turn, and treating the
      // document as "finished" would skip straight to the next one.
      if (loading || numPages === 0) return;
      if (dir === 1) {
        if (page < numPages) setPage(page + 1);
        else if (next) router.push(next.href);
      } else if (page > 1) {
        setPage(page - 1);
      } else if (prev) {
        router.push(prev.href);
      }
    },
    [loading, numPages, page, next, prev, router],
  );

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
        setPage(1);
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
        // Immersive uses a tighter inset so the page fills more of the screen.
        const inset = immersive ? 16 : 32;
        // Fit the WHOLE page, not just its width: a portrait page scaled to the
        // reader's width is far taller than the reader, so only the top of it was
        // ever visible. Fitting both axes shows the full page, and zoom then
        // enlarges from there.
        const availW = Math.max(120, (box?.clientWidth ?? 800) - inset);
        const availH = Math.max(120, (box?.clientHeight ?? 600) - inset);
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
  }, [page, zoom, loading, numPages, immersive, fitTick]);

  // Arrow keys page through the document; Escape leaves the immersive layout.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "ArrowRight") advance(1);
      else if (e.key === "ArrowLeft") advance(-1);
      else if (e.key === "Escape" && immersive) setImmersive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, immersive]);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Only a deliberate, mostly-horizontal swipe turns the page — otherwise
    // vertical scrolling and pinch-zoom would fight the reader.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // Zoomed in, a horizontal drag is panning, not a page turn.
    if (zoom !== 1) return;
    advance(dx < 0 ? 1 : -1);
  }

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
  const iconBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:border-brand-1 hover:text-brand-1 disabled:opacity-40 dark:hover:text-brand-3";

  // The reader fills the page rather than sitting in a small box. The height is
  // the viewport minus the surrounding chrome (shell padding, the breadcrumb,
  // the caption below, and on mobile the header and nav strip). Mobile carries
  // more chrome, hence the larger offset. dvh rather than vh so mobile browser
  // toolbars don't clip the bottom.
  //
  // Immersive pins the whole reader over the viewport, so the content box — not
  // the surrounding page — is what fills the screen.
  const shellClass = immersive
    ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface-2"
    : "relative flex h-[calc(100dvh-15rem)] min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-surface-2 md:h-[calc(100dvh-10rem)]";

  const atFirst = page <= 1;
  const atLast = numPages > 0 && page >= numPages;

  const toolbar = (
    <div
      className={`flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2.5 ${
        immersive ? "shadow-lg" : ""
      }`}
    >
      <span className="mr-auto truncate text-sm font-semibold">{title}</span>

      <div className="flex items-center gap-1.5">
        <button
          className={iconBtn}
          onClick={() => advance(-1)}
          disabled={atFirst && !prev}
          aria-label={atFirst && prev ? `Previous: ${prev.title}` : "Previous page"}
          title={atFirst && prev ? `Previous: ${prev.title}` : "Previous page"}
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-1 text-xs font-medium text-text-muted">
          {loading ? "…" : `${page} / ${numPages}`}
        </span>
        <button
          className={iconBtn}
          onClick={() => advance(1)}
          disabled={atLast && !next}
          aria-label={atLast && next ? `Next: ${next.title}` : "Next page"}
          title={atLast && next ? `Next: ${next.title}` : "Next page"}
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          className={iconBtn}
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <IconZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          title="Fit the page to the reader"
          className="w-12 text-center text-xs font-medium text-text-muted hover:text-brand-1 dark:hover:text-brand-3"
        >
          {zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`}
        </button>
        <button
          className={iconBtn}
          onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <IconZoomIn className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search pages…"
            className="w-32 rounded-lg border border-border bg-surface-2 py-1.5 pl-8 pr-2.5 text-xs focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
          />
        </div>
        <button className={btn} onClick={search} disabled={searchBusy || !searchQuery.trim()}>
          {searchBusy ? "…" : "Find"}
        </button>
      </div>

      <button
        className={iconBtn}
        onClick={toggleImmersive}
        aria-pressed={immersive}
        aria-label={immersive ? "Exit full screen" : "Read the page full screen"}
        title={immersive ? "Exit full screen" : "Read the page full screen"}
      >
        {immersive ? <IconCollapse className="h-4 w-4" /> : <IconExpand className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <div className={shellClass}>
      {/* Not immersive: the controls sit above the content in the normal flow. */}
      {immersive ? null : toolbar}

      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseMove={immersive ? showControls : undefined}
        onClick={immersive ? showControls : undefined}
        className={`flex-1 overflow-auto bg-surface-2 ${immersive ? "p-2" : "p-4"}`}
      >
        {error ? (
          <p className="py-16 text-center text-sm text-text-muted">{error}</p>
        ) : (
          <>
            {loading ? (
              <p className="py-16 text-center text-sm text-text-muted">Opening document…</p>
            ) : null}
            <canvas ref={canvasRef} className="mx-auto block max-w-full shadow-sm" />
          </>
        )}
      </div>

      {/* At the end of a document, offer the next one instead of a dead end. A
          floating pill keeps it reachable even though a full page fills the
          reader, without adding height to the page. */}
      {immersive && atLast && next ? (
        <button
          onClick={() => router.push(next.href)}
          className={`absolute bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand-1 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-opacity duration-300 hover:bg-brand-2 ${
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          Next: {next.title}
          <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {/* Immersive: the controls float over the page and fade out when idle, so
          the content — not the control panel — is what fills the screen. They sit
          outside the scroll container so scrolling never moves them. */}
      {immersive ? (
        <div
          className={`absolute inset-x-0 top-0 z-10 transition-opacity duration-300 ${
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {toolbar}
        </div>
      ) : null}
    </div>
  );
}
