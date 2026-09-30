// npm run seed:generate: render the five supplier responses, their attachments,
// seed/suppliers/manifest.json and seed/ground_truth.json. Needs Google Chrome (macOS).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ATTACHMENTS } from "./attachments";
import { htmlToPdf, htmlToPng, pngToJpeg } from "./chrome";
import { buildGroundTruth } from "./groundTruth";
import { SUPPLIER_FACTS, type SupplierCode } from "./prices";
import { buildSupplierA } from "./supplierA";
import { buildSupplierBHtml } from "./supplierB";
import { buildSupplierC } from "./supplierC";
import { buildPhotoHtml } from "./supplierD";
import { buildSupplierE } from "./supplierE";

const SEED_DIR = path.join(process.cwd(), "seed");
const OUT = path.join(SEED_DIR, "suppliers");
const SOURCE = path.join(OUT, "_source");
const STORAGE_PREFIX = "it-refresh-2026";

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  jpg: "image/jpeg",
  txt: "text/plain",
} as const;

type ManifestDocument = { file_name: string; local_path: string; storage_path: string; mime_type: string; page_count: number | null };
type ManifestResponse = { supplier_code: SupplierCode; received_at: string; channel: "email"; body_text: string; documents: ManifestDocument[] };

function pdfPageCount(file: string): number {
  return (readFileSync(file, "latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

function doc(code: SupplierCode, fileName: string, pageCount: number | null): ManifestDocument {
  const ext = path.extname(fileName).slice(1) as keyof typeof MIME;
  return {
    file_name: fileName,
    local_path: `${code}/${fileName}`,
    storage_path: `${STORAGE_PREFIX}/${code}/${fileName}`,
    mime_type: MIME[ext],
    page_count: pageCount,
  };
}

async function writePdfFromHtml(code: SupplierCode, baseName: string, html: string): Promise<ManifestDocument> {
  const htmlPath = path.join(SOURCE, `${baseName}.html`);
  const pdfPath = path.join(OUT, code, `${baseName}.pdf`);
  writeFileSync(htmlPath, html);
  await htmlToPdf(htmlPath, pdfPath);
  return doc(code, `${baseName}.pdf`, pdfPageCount(pdfPath));
}

async function main() {
  // Fail before writing anything if the demo beats do not come out of the numbers.
  const groundTruth = buildGroundTruth();

  rmSync(OUT, { recursive: true, force: true });
  for (const dir of [SOURCE, ...["A", "B", "C", "D", "E"].map((c) => path.join(OUT, c))]) mkdirSync(dir, { recursive: true });

  const manifest: ManifestResponse[] = [];

  // A: Excel + ISO + OEM letter
  const aFile = "Prakash_Quotation_PD-BLR-Q-2026-0412.xlsx";
  writeFileSync(path.join(OUT, "A", aFile), buildSupplierA());
  manifest.push({
    supplier_code: "A",
    received_at: SUPPLIER_FACTS.A.received_at,
    channel: "email",
    body_text: "Dear Priya,\n\nPlease find attached our quotation for the IT refresh, along with our ISO certificate and Lenovo authorisation.\n\nRegards,\nRamesh Prakash\nPrakash Distributors",
    documents: [
      doc("A", aFile, null),
      await writePdfFromHtml("A", "Prakash_ISO_9001_Certificate", ATTACHMENTS.A_ISO()),
      await writePdfFromHtml("A", "Prakash_OEM_Authorisation_Lenovo", ATTACHMENTS.A_OEM()),
    ],
  });

  // B: letterhead PDF + ISO + OEM letter + warranty letter
  manifest.push({
    supplier_code: "B",
    received_at: SUPPLIER_FACTS.B.received_at,
    channel: "email",
    body_text: "Hi Priya,\n\nAttached is Vertex Systems' quotation VS/Q/2026/0917 with our ISO certificate, Dell authorisation and warranty letter. Note the quote is valid for 7 days.\n\nThanks,\nArvind Menon\nVertex Systems",
    documents: [
      await writePdfFromHtml("B", "Vertex_Quotation_VS-Q-2026-0917", buildSupplierBHtml()),
      await writePdfFromHtml("B", "Vertex_ISO_9001_Certificate", ATTACHMENTS.B_ISO()),
      await writePdfFromHtml("B", "Vertex_OEM_Authorisation_Dell", ATTACHMENTS.B_OEM()),
      await writePdfFromHtml("B", "Vertex_Warranty_Letter", ATTACHMENTS.B_WARRANTY()),
    ],
  });

  // C: Word proposal + expired ISO
  const cFile = "Nexa_Commercial_Proposal_Meridian.docx";
  writeFileSync(path.join(OUT, "C", cFile), await buildSupplierC());
  manifest.push({
    supplier_code: "C",
    received_at: SUPPLIER_FACTS.C.received_at,
    channel: "email",
    body_text: "Dear Priya,\n\nPlease see our commercial proposal attached, with our ISO 9001 certificate.\n\nWarm regards,\nSuresh Nair\nNexa Integrators",
    documents: [doc("C", cFile, null), await writePdfFromHtml("C", "Nexa_ISO_9001_Certificate", ATTACHMENTS.C_ISO())],
  });

  // D: phone photo of a printed rate card
  const dHtml = path.join(SOURCE, "SriGanesh_RateCard_photo.html");
  const dPng = path.join(SOURCE, "SriGanesh_RateCard_photo.png");
  const dFile = "IMG_20260918_131402.jpg";
  writeFileSync(dHtml, buildPhotoHtml());
  await htmlToPng(dHtml, dPng, 1200, 1600);
  pngToJpeg(dPng, path.join(OUT, "D", dFile));
  rmSync(dPng);
  manifest.push({
    supplier_code: "D",
    received_at: SUPPLIER_FACTS.D.received_at,
    channel: "email",
    body_text: "Madam,\n\nPls find our rate list attached. Sent from my phone.\n\nGanesh\nSri Ganesh Computers",
    documents: [doc("D", dFile, 1)],
  });

  // E: the email body is the quote
  const eBody = buildSupplierE();
  const eFile = "Lionbridge_email_2026-09-14.txt";
  writeFileSync(path.join(OUT, "E", eFile), eBody);
  manifest.push({
    supplier_code: "E",
    received_at: SUPPLIER_FACTS.E.received_at,
    channel: "email",
    body_text: eBody,
    documents: [doc("E", eFile, 1)],
  });

  writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(path.join(SEED_DIR, "ground_truth.json"), JSON.stringify(groundTruth, null, 2) + "\n");

  for (const r of manifest) {
    console.log(`${r.supplier_code}: ${r.documents.map((d) => `${d.file_name}${d.page_count ? ` (${d.page_count}p)` : ""}`).join(", ")}`);
  }
  console.log("Demo beats:", JSON.stringify({ d_l1: groundTruth.demo_beats.d_nominal_l1_lines, basket: groundTruth.demo_beats.common_basket_totals_inr }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
