import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, safeFileName, validateSupplierName, validateUpload } from "@/lib/uploads/validate";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(20).fill(0x20)]);

describe("upload validation", () => {
  it("accepts the six types when the first bytes match", () => {
    expect(validateUpload("q.pdf", bytes(0x25, 0x50, 0x44, 0x46))).toMatchObject({ ok: true, mime: "application/pdf" });
    expect(validateUpload("q.xlsx", bytes(0x50, 0x4b, 0x03, 0x04))).toMatchObject({ ok: true });
    expect(validateUpload("q.docx", bytes(0x50, 0x4b, 0x03, 0x04))).toMatchObject({ ok: true });
    expect(validateUpload("q.JPG", bytes(0xff, 0xd8, 0xff))).toMatchObject({ ok: true, mime: "image/jpeg" });
    expect(validateUpload("q.png", bytes(0x89, 0x50, 0x4e, 0x47))).toMatchObject({ ok: true, mime: "image/png" });
    expect(validateUpload("q.txt", new TextEncoder().encode("Laptop i5: 64,000 per unit"))).toMatchObject({ ok: true, mime: "text/plain" });
  });

  it("refuses other types, renamed files, empty and oversized files", () => {
    expect(validateUpload("q.exe", bytes(0x4d, 0x5a)).ok).toBe(false);
    expect(validateUpload("q.csv", new TextEncoder().encode("a,b")).ok).toBe(false);
    expect(validateUpload("fake.pdf", bytes(0x4d, 0x5a)).ok).toBe(false);
    expect(validateUpload("q.txt", new Uint8Array([0x41, 0x00, 0x42])).ok).toBe(false);
    expect(validateUpload("q.pdf", new Uint8Array()).ok).toBe(false);
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set([0x25, 0x50, 0x44, 0x46]);
    expect(validateUpload("q.pdf", big)).toMatchObject({ ok: false });
  });

  it("cleans file names and supplier names", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("My quote (final) v2.pdf")).toBe("My_quote_final_v2.pdf");
    expect(validateSupplierName("  Kaveri   Office Systems ")).toBe("Kaveri Office Systems");
    expect(validateSupplierName(" x ")).toBeNull();
  });
});
