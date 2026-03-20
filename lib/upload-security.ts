const allowedImageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const imageUploadLimits = {
  maxFiles: 8,
  maxFileSizeBytes: 5 * 1024 * 1024,
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
