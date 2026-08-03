import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_MEDIA_TYPES, type ImageMediaType } from '../ai/identifySpecies.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const EXTENSION_BY_MEDIA_TYPE: Record<ImageMediaType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export class UnsupportedImageTypeError extends Error {}

export function isSupportedImageType(mimeType: string): mimeType is ImageMediaType {
  return SUPPORTED_MEDIA_TYPES.includes(mimeType);
}

export async function saveUploadedImage(buffer: Buffer, mimeType: string): Promise<string> {
  if (!isSupportedImageType(mimeType)) {
    throw new UnsupportedImageTypeError(`Unsupported image type: ${mimeType}`);
  }

  await mkdir(UPLOADS_DIR, { recursive: true });

  const filename = `${randomUUID()}.${EXTENSION_BY_MEDIA_TYPE[mimeType]}`;
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);

  return `/uploads/${filename}`;
}
