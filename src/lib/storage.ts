import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { db } from "./db";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "documents");

/**
 * Hard ceiling for any upload. Vercel rejects serverless request bodies above
 * ~4.5MB before the handler runs, which surfaces as an opaque 413, so keep
 * limits below that and fail with a message the student can act on instead.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const AVATAR_MAX_BYTES = MAX_UPLOAD_BYTES;
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** The effective size limit for an upload, never above the platform ceiling. */
export function effectiveMaxBytes(configuredMb: number) {
  return Math.min(configuredMb * 1024 * 1024, MAX_UPLOAD_BYTES);
}

export type StoredFile = { documentId: string; fileName: string };

/** A safe, unique filename that never contains path separators. */
export function storageKeyFor(fileName: string) {
  return `${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

/**
 * Persist an upload and register a Document. Callers must authorize; this only
 * handles storage. Bytes are kept in the database because serverless platforms
 * (Vercel) provide a read-only, ephemeral filesystem — writing to `storage/`
 * there fails or vanishes, which broke uploads in production. Where the local
 * disk is usable we also keep a copy, so file-based tooling keeps working.
 */
export async function storeUpload(
  file: File,
  uploadedById: string,
  options?: { maxBytes?: number; allowedMimeTypes?: string[] }
): Promise<{ ok: true; stored: StoredFile } | { ok: false; error: string }> {
  const maxBytes = options?.maxBytes ?? AVATAR_MAX_BYTES;
  if (file.size > maxBytes) {
    return { ok: false, error: `Files must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller.` };
  }
  if (options?.allowedMimeTypes && !options.allowedMimeTypes.includes(file.type)) {
    return { ok: false, error: "That file type isn't supported." };
  }

  const storagePath = storageKeyFor(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());

  const doc = await db.document.create({
    data: {
      title: file.name,
      storagePath,
      data: bytes,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedById,
    },
  });

  await writeToDiskIfPossible(storagePath, bytes);

  return { ok: true, stored: { documentId: doc.id, fileName: file.name } };
}

/** Best-effort local copy. Failures are expected (and harmless) on serverless. */
export async function writeToDiskIfPossible(storagePath: string, bytes: Buffer) {
  try {
    await mkdir(STORAGE_ROOT, { recursive: true });
    await writeFile(path.join(STORAGE_ROOT, storagePath), bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a document's bytes: the database first, then the local disk so
 * documents uploaded before this change keep working.
 */
export async function readDocumentBytes(doc: {
  storagePath: string;
  data: Uint8Array | Buffer | null;
}): Promise<Buffer | null> {
  if (doc.data) return Buffer.from(doc.data);

  // Containment: never read outside the storage root.
  const fullPath = path.join(STORAGE_ROOT, doc.storagePath);
  if (!fullPath.startsWith(STORAGE_ROOT + path.sep)) return null;
  try {
    return await readFile(fullPath);
  } catch {
    return null;
  }
}