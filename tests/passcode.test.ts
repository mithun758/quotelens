import { afterEach, describe, expect, it, vi } from "vitest";
import { checkPasscode, isValidSessionToken, sessionToken } from "@/lib/auth/passcode";

afterEach(() => vi.unstubAllEnvs());

describe("passcode gate", () => {
  it("fails closed when DEMO_PASSCODE is not set", () => {
    vi.stubEnv("DEMO_PASSCODE", "");
    expect(checkPasscode("")).toBe(false);
    expect(checkPasscode("anything")).toBe(false);
    expect(sessionToken()).toBeNull();
    expect(isValidSessionToken("")).toBe(false);
  });

  it("accepts only the configured passcode", () => {
    vi.stubEnv("DEMO_PASSCODE", "meridian");
    expect(checkPasscode("meridian")).toBe(true);
    expect(checkPasscode("Meridian")).toBe(false);
    expect(checkPasscode("")).toBe(false);
  });

  it("issues a token that does not contain the passcode", () => {
    vi.stubEnv("DEMO_PASSCODE", "meridian");
    const token = sessionToken()!;
    expect(token).not.toContain("meridian");
    expect(isValidSessionToken(token)).toBe(true);
    expect(isValidSessionToken(undefined)).toBe(false);
    expect(isValidSessionToken("forged")).toBe(false);
  });

  it("invalidates old cookies when the passcode changes", () => {
    vi.stubEnv("DEMO_PASSCODE", "meridian");
    const oldToken = sessionToken()!;
    vi.stubEnv("DEMO_PASSCODE", "rotated");
    expect(isValidSessionToken(oldToken)).toBe(false);
  });
});
