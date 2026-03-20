import { describe, expect, it } from "vitest";

import { escapeCsvCell } from "@/lib/csv";

describe("csv security", () => {
  it("prefixes dangerous spreadsheet formulas", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("\"'=SUM(A1:A2)\"");
    expect(escapeCsvCell(" @cmd")).toBe("\"' @cmd\"");
  });

  it("still escapes quotes for regular values", () => {
    expect(escapeCsvCell("hello \"world\"")).toBe("\"hello \"\"world\"\"\"");
  });
});
