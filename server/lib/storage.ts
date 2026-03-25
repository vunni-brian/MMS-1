import fs from "node:fs";
import path from "node:path";

import { config } from "../config.ts";
import type { FilePayload } from "../types.ts";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

export const validateFilePayload = (
  file: FilePayload | null | undefined,
  allowedMimeTypes: string[],
  required = false,
) => {
  if (!file) {
    if (required) {
      throw new Error("File is required.");
    }
    return;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File must be 5MB or smaller.");
  }

  if (!allowedMimeTypes.includes(file.mimeType)) {
    throw new Error("Unsupported file type.");
  }
};

export const persistFilePayload = (subdirectory: string, prefix: string, file: FilePayload) => {
  validateFilePayload(file, [file.mimeType], true);

  const directory = path.join(config.uploadsDir, subdirectory);
  fs.mkdirSync(directory, { recursive: true });

  const safeName = sanitizeName(file.name);
  const filePath = path.join(directory, `${prefix}-${Date.now()}-${safeName}`);
  const buffer = Buffer.from(file.base64, "base64");
  fs.writeFileSync(filePath, buffer);

  return {
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    storagePath: filePath,
  };
};
