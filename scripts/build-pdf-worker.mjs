/**
 * Builds the PDF.js worker that ships in public/.
 *
 * The stock worker is a module that immediately calls APIs a slightly older
 * browser does not have, so it throws before it can post "ready" and the reader
 * falls back to running PDF.js on the main thread — where it throws as well. The
 * result is a document that never opens, on exactly the phones whose browsers
 * lack those APIs.
 *
 * The worker cannot be patched by the page, so the polyfills are prepended to it
 * here instead. They are the same shims the page itself installs, inlined rather
 * than imported because a module worker cannot be a classic script and the
 * polyfill file is deliberately import-free.
 *
 * Run: node scripts/build-pdf-worker.mjs
 *
 * It writes two things from one source of truth (scripts/pdfjs-polyfill.js):
 *   public/pdf.worker.min.mjs  — shims inlined ahead of the stock worker
 *   src/lib/pdfjs-polyfill.js  — the same shims for the page itself to import
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workerSrc = join(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const polyfillSrc = join(root, "scripts/pdfjs-polyfill.js");
const outFile = join(root, "public/pdf.worker.min.mjs");
const clientCopy = join(root, "src/lib/pdfjs-polyfill.js");

const worker = readFileSync(workerSrc, "utf8");
const polyfill = readFileSync(polyfillSrc, "utf8");

// A module worker may only contain one import statement, and pdfjs's is a
// lazy WASM probe guarded by a try/catch. Inlining the polyfill above it is
// therefore safe, but assert that we are not breaking that assumption.
const importCount = (worker.match(/^\s*import[\s(]/gm) || []).length;
if (importCount > 1) {
  throw new Error(
    `Expected at most one import in the worker (the lazy WASM probe), found ${importCount}. ` +
      "Check how the polyfill should be inlined before shipping this.",
  );
}

const banner =
  "/* UCA Sandbox: PDF.js compatibility shims prepended by scripts/build-pdf-worker.mjs.\n" +
  "   Do not edit public/pdf.worker.min.mjs by hand — regenerate it. */\n";

writeFileSync(outFile, `${banner}${polyfill}\n${worker}`);

const clientBanner =
  "// Generated from scripts/pdfjs-polyfill.js by scripts/build-pdf-worker.mjs.\n" +
  "// Edit that file and re-run the script rather than editing this copy.\n";
writeFileSync(clientCopy, `${clientBanner}${polyfill}`);

console.log(`Wrote ${outFile} (${(Buffer.byteLength(polyfill) / 1024).toFixed(1)} KB of shims)`);
console.log(`Wrote ${clientCopy}`);
