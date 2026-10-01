import { describe, expect, it } from "vitest";
import { OVERRIDE_MIN_CHARS, overrideReasonProblem } from "@/lib/award/override";
import { addOverride } from "@/lib/award/store";
import type { Db } from "@/lib/db/client";

const blocker = { key: "stale_supplier:B", type: "stale_supplier", supplier: "B", line: null, detail: "Quote lapses before approval" } as Parameters<typeof addOverride>[1];

describe("override reason", () => {
  it("needs at least 15 characters once trimmed", () => {
    expect(OVERRIDE_MIN_CHARS).toBe(15);
    expect(overrideReasonProblem("Phoned them.")).toMatch(/at least 15 characters/);
    expect(overrideReasonProblem("   fourteen chars   ".slice(0, 17))).not.toBeNull();
    expect(overrideReasonProblem("Confirmed by phone")).toBeNull();
  });

  it("the server refuses a short reason before touching the database", async () => {
    // Any database access would throw a different error; the reason check comes first.
    const db = new Proxy({}, { get: () => { throw new Error("database touched"); } }) as unknown as Db;
    await expect(addOverride(db, blocker, "Too short")).rejects.toThrow(/at least 15 characters/);
    await expect(addOverride(db, blocker, "  ok, approved  ")).rejects.toThrow(/at least 15 characters/);
  });
});
