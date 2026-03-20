import { describe, expect, it } from "vitest";

import {
  getSafeImageExtension,
  imageUploadLimits,
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
});
