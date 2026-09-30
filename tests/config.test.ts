import { afterEach, describe, expect, it, vi } from "vitest";
import { asOfDate, formatDisplayDate } from "@/lib/config";

afterEach(() => vi.unstubAllEnvs());

describe("config", () => {
  it("defaults the as-of date to 30 Sep 2026", () => {
    vi.stubEnv("AS_OF_DATE", undefined);
    expect(asOfDate()).toBe("2026-09-30");
  });

  it("reads AS_OF_DATE and rejects malformed values", () => {
    vi.stubEnv("AS_OF_DATE", "2026-10-10");
    expect(asOfDate()).toBe("2026-10-10");
    vi.stubEnv("AS_OF_DATE", "10/10/2026");
    expect(() => asOfDate()).toThrow();
  });

  it("formats dates as '30 Sep 2026'", () => {
    expect(formatDisplayDate("2026-09-30")).toBe("30 Sep 2026");
    expect(formatDisplayDate("2026-06-04")).toBe("4 Jun 2026");
  });
});
