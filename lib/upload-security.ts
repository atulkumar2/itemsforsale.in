import "server-only";

import sharp from "sharp";

import { imageUploadLimits } from "@/lib/constants";

const allowedImageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const processedImageSettings = {
  display: {
    format: "webp",
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 72,
  },
  thumbnail: {
    format: "webp",
    maxWidth: 480,
    maxHeight: 480,
    quality: 64,
  },
} as const;

export function validateImageUploads(files: File[]) {
  if (files.length > imageUploadLimits.maxFiles) {
    throw new Error(`Upload up to ${imageUploadLimits.maxFiles} images at a time.`);
  }

  for (const file of files) {
    if (!(file.type in allowedImageTypes)) {
      throw new Error("Only JPG, PNG, and WebP images are allowed.");
    }

    if (file.size > imageUploadLimits.maxFileSizeBytes) {
      throw new Error(`Each image must be ${imageUploadLimits.maxFileSizeBytes / (1024 * 1024)} MB or smaller.`);
    }
  }
}

export function getSafeImageExtension(file: File) {
  return allowedImageTypes[file.type as keyof typeof allowedImageTypes] ?? null;
}

export async function processUploadedImage(file: File) {
  const input = Buffer.from(await file.arrayBuffer());
  const baseImage = sharp(input, { failOn: "error" }).rotate();
  const display = await baseImage
    .clone()
    .resize({
      width: processedImageSettings.display.maxWidth,
      height: processedImageSettings.display.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: processedImageSettings.display.quality })
    .toBuffer();
  const thumbnail = await baseImage
    .clone()
    .resize({
      width: processedImageSettings.thumbnail.maxWidth,
      height: processedImageSettings.thumbnail.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: processedImageSettings.thumbnail.quality })
    .toBuffer();

  return {
    display: {
      bytes: display,
      extension: processedImageSettings.display.format,
      mimeType: "image/webp" as const,
    },
    thumbnail: {
      bytes: thumbnail,
      extension: processedImageSettings.thumbnail.format,
      mimeType: "image/webp" as const,
    },
  };
}
