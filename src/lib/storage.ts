import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { db } from "./db";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "documents");

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type StoredFile = { documentId: string; fileName: string };

/**
 * Persist an upload to protected storage and register a Document. Callers must
 * authorize; this only handles storage. Files are never written to a public path.
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

  const storagePath = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await mkdir(STORAGE_ROOT, { recursive: true });
  await writeFile(path.join(STORAGE_ROOT, storagePath), Buffer.from(await file.arrayBuffer()));

  const doc = await db.document.create({
    data: {
      title: file.name,
      storagePath,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedById,
    },
  });
  return { ok: true, stored: { documentId: doc.id, fileName: file.name } };
}
