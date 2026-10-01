// What a buyer may upload as a supplier response: one file, a known type, at most 10 MB.
// The type is decided by the extension and confirmed by the file's first bytes, so a
// renamed file is refused rather than sent to the model as something it is not.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type Kind = { mime: string; label: string; magic?: number[] };
const ZIP = [0x50, 0x4b, 0x03, 0x04];
export const UPLOAD_TYPES: Record<string, Kind> = {
  pdf: { mime: "application/pdf", label: "PDF", magic: [0x25, 0x50, 0x44, 0x46] },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel", magic: ZIP },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word", magic: ZIP },
  jpg: { mime: "image/jpeg", label: "JPG", magic: [0xff, 0xd8, 0xff] },
  jpeg: { mime: "image/jpeg", label: "JPG", magic: [0xff, 0xd8, 0xff] },
  png: { mime: "image/png", label: "PNG", magic: [0x89, 0x50, 0x4e, 0x47] },
  txt: { mime: "text/plain", label: "text" },
};
export const ACCEPT = Object.keys(UPLOAD_TYPES)
  .map((e) => `.${e}`)
  .join(",");

export type UploadCheck = { ok: true; mime: string; fileName: string } | { ok: false; error: string };

// Letters, digits, dot, dash and underscore only; the extension is kept.
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^[._]+/, "");
  return cleaned.slice(-80) || "file";
}

export function validateUpload(name: string, bytes: Uint8Array): UploadCheck {
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: `The file is ${(bytes.length / 1024 / 1024).toFixed(1)} MB; the limit is 10 MB.` };
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const kind = UPLOAD_TYPES[ext];
  if (!kind || !name.includes(".")) return { ok: false, error: "Upload a PDF, Excel (.xlsx), Word (.docx), JPG, PNG or text (.txt) file." };
  if (kind.magic && !kind.magic.every((b, i) => bytes[i] === b)) return { ok: false, error: `This file does not look like a real ${kind.label} file. Check it opens, then try again.` };
  if (ext === "txt") {
    const head = bytes.subarray(0, 4096);
    if (head.includes(0)) return { ok: false, error: "This does not look like a text file." };
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(head.subarray(0, head.length - 4 > 0 ? head.length - 4 : head.length));
    } catch {
      return { ok: false, error: "Text files must be UTF-8." };
    }
  }
  return { ok: true, mime: kind.mime, fileName: safeFileName(name) };
}

export function validateSupplierName(name: string): string | null {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 2) return null;
  return n.slice(0, 80);
}
