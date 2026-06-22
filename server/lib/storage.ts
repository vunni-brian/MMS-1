/**
 * @file Local file storage helpers.
 * Manages upload and static directories, file existence checks, and safe
 * file-path resolution within the configured storage root.
 */

import fs from "node:fs";
import path from "node:path";

import { config } from "../config.ts";
import { HttpError } from "./http.ts";
import { deleteSupabaseStorageObject, uploadSupabaseStorageObject } from "./supabase.ts";
import type { FilePayload } from "../types.ts";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

/** Validate a file upload — required check, size limit (5 MB), and allowed MIME types. */
export const validateFilePayload = (
  file: FilePayload | null | undefined,
  allowedMimeTypes: string[],
  required = false,
) => {
  if (!file) {
    if (required) {
      throw new HttpError(400, "File is required.");
    }
    return;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, "File must be 5MB or smaller.");
  }

  if (!allowedMimeTypes.includes(file.mimeType)) {
    throw new HttpError(400, "Unsupported file type.");
  }
};

/** Persist a file upload — validates, then stores to Supabase Storage or local disk. */
export const persistFilePayload = async (subdirectory: string, prefix: string, file: FilePayload) => {
  validateFilePayload(file, [file.mimeType], true);
  if (!/^[a-zA-Z0-9+/]+={0,2}$/.test(file.base64)) {
    throw new HttpError(400, "Uploaded file payload is invalid.");
  }
  const buffer = Buffer.from(file.base64, "base64");
  if (buffer.length !== file.size) {
    throw new HttpError(400, "Uploaded file size does not match the payload.");
  }

  const safePrefix = sanitizeName(prefix);
  const directory = path.join(config.uploadsDir, subdirectory);
  const safeName = sanitizeName(file.name);
  const fileName = `${safePrefix}-${Date.now()}-${safeName}`;

  if (config.supabaseStorageEnabled) {
    const objectPath = `${subdirectory}/${safePrefix}/${fileName}`;
    const storagePath = await uploadSupabaseStorageObject({
      objectPath,
      body: buffer,
      contentType: file.mimeType,
    });

    return {
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      storagePath,
    };
  }

  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, fileName);
  fs.writeFileSync(filePath, buffer);

  return {
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    storagePath: filePath,
  };
};

/** Delete a previously stored file (Supabase Storage or local disk). */
export const removeStoredFile = async (storagePath: string | null | undefined) => {
  if (!storagePath) {
    return;
  }

  if (storagePath.startsWith("supabase://")) {
    await deleteSupabaseStorageObject(storagePath);
    return;
  }

  try {
    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
    }
  } catch (error) {
    console.error(`Unable to delete stored file ${storagePath}:`, error);
  }
};
