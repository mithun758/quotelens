import { describe, expect, it } from "vitest";
import { gstinState, isValidGstin } from "@/lib/gstin";

describe("GSTIN validation", () => {
  it("accepts a well-formed GSTIN with the right check character", () => {
    expect(isValidGstin("33AAGCL8104H1ZP")).toBe(true);
    expect(gstinState("33AAGCL8104H1ZP")).toBe("Tamil Nadu");
  });

  it("rejects a wrong check character", () => {
    expect(isValidGstin("33AAGCL8104H1ZE")).toBe(false);
  });

  it("rejects a malformed GSTIN", () => {
    expect(isValidGstin("33AAGCL8104H1XP")).toBe(false);
    expect(isValidGstin("33AAGCL8104H1Z")).toBe(false);
  });
});
