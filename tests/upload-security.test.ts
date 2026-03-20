import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  getSafeImageExtension,
  imageUploadLimits,
  processUploadedImage,
  validateImageUploads,
} from "@/lib/upload-security";

describe("upload security", () => {
  it("accepts supported raster image types", () => {
    const file = new File(["abc"], "chair.png", { type: "image/png" });

    expect(() => validateImageUploads([file])).not.toThrow();
    expect(getSafeImageExtension(file)).toBe("png");
  });

  it("rejects unsupported file types and oversized uploads", () => {
    const svg = new File(["<svg></svg>"], "x.svg", { type: "image/svg+xml" });
    const large = new File(["a".repeat(imageUploadLimits.maxFileSizeBytes + 1)], "x.jpg", {
      type: "image/jpeg",
    });

    expect(() => validateImageUploads([svg])).toThrow("Only JPG, PNG, and WebP images are allowed.");
    expect(() => validateImageUploads([large])).toThrow("Each image must be 5 MB or smaller.");
  });

  it("re-encodes uploads to compressed webp output", async () => {
    const input = await sharp({
      create: {
        width: 2000,
        height: 1200,
        channels: 3,
        background: { r: 220, g: 180, b: 120 },
      },
    })
      .png()
      .toBuffer();
    const file = new File([input], "chair.png", { type: "image/png" });

    const processed = await processUploadedImage(file);
    const displayMetadata = await sharp(processed.display.bytes).metadata();
    const thumbnailMetadata = await sharp(processed.thumbnail.bytes).metadata();

    expect(processed.display.extension).toBe("webp");
    expect(processed.thumbnail.extension).toBe("webp");
    expect(processed.display.mimeType).toBe("image/webp");
    expect(displayMetadata.format).toBe("webp");
    expect(thumbnailMetadata.format).toBe("webp");
    expect(displayMetadata.width).toBeLessThanOrEqual(1600);
    expect(displayMetadata.height).toBeLessThanOrEqual(1600);
    expect(thumbnailMetadata.width).toBeLessThanOrEqual(480);
    expect(thumbnailMetadata.height).toBeLessThanOrEqual(480);
  });
});
