// Seed inputs only, taken from the Dataset section of docs/SOURCE_OF_TRUTH.md.
// No supplier prices, extracted values or questionnaire answers live here:
// those come from the supplier documents via real extraction.

import type { QuestionnaireQuestion, RfxTerms } from "@/lib/db/types";

export const RFX = {
  title: "IT Refresh 2026",
  category: "IT hardware",
  sent_at: "2026-09-12",
  // Approval completes 10 Oct (as-of + 10 days); delivery within 21 days after.
  need_by_date: "2026-10-31",
  approval_days: 10,
  status: "sent" as const,
  terms: {
    validity_required: true,
    requested_validity_days: 30,
    gst_basis: "Quote prices ex-GST, with the GST rate stated per line",
    delivery_hubs: ["Bengaluru", "Chennai", "Hyderabad"],
    delivery_basis: "Delivered to hub, freight included",
    delivery_days: 21,
    warranty: "India warranty with onsite support in Bengaluru, Chennai and Hyderabad",
    payment: "45 days from invoice",
    currency: "INR",
  } satisfies RfxTerms,
};

export const QUESTIONNAIRE: QuestionnaireQuestion[] = [
  { key: "iso_9001", text: "Do you hold a valid ISO 9001 certificate? Attach it.", evidence_required: true },
  { key: "oem_authorisation", text: "Are you authorised by the OEM for the models quoted? Attach the authorisation letter.", evidence_required: true },
  { key: "india_warranty_onsite", text: "Do you provide India warranty with onsite support in Bengaluru, Chennai and Hyderabad?", evidence_required: false },
  { key: "delivery_21_days", text: "Can you deliver to all three hubs within 21 days of the purchase order?", evidence_required: false },
  { key: "gst_registration", text: "Are you registered for GST in India? State your GSTIN.", evidence_required: false },
  { key: "ewaste_takeback", text: "Do you offer e-waste take-back for replaced equipment?", evidence_required: false },
  { key: "escalation_contact", text: "Name an escalation contact for this account.", evidence_required: false },
  { key: "healthcare_references", text: "Provide two references from healthcare or diagnostics customers.", evidence_required: false },
];

export type SeedLineItem = {
  line_no: number;
  description: string;
  category: string;
  spec: Record<string, string | number | boolean>;
  quantity: number;
  uom: string;
  last_cycle_price_inr: number;
  memory_exposed: boolean;
};

// Applied to every line: the RFx specs are vendor-neutral.
export const ACCEPTABLE_EQUIVALENTS = "Any OEM. Every listed attribute must be met or exceeded.";

export const LINE_ITEMS: SeedLineItem[] = [
  { line_no: 1, description: 'Business laptop, Intel Core i5 (14th gen), 16 GB, 512 GB SSD, 14"', category: "Computing", spec: { form_factor: "laptop", cpu: "Intel Core i5", cpu_generation_min: 14, ram_gb: 16, ssd_gb: 512, display_in: 14 }, quantity: 60, uom: "piece", last_cycle_price_inr: 68000, memory_exposed: true },
  { line_no: 2, description: 'Management laptop, Core i7, 32 GB, 1 TB SSD, 14"', category: "Computing", spec: { form_factor: "laptop", cpu: "Intel Core i7", ram_gb: 32, ssd_gb: 1024, display_in: 14 }, quantity: 10, uom: "piece", last_cycle_price_inr: 105000, memory_exposed: true },
  { line_no: 3, description: "Laptop backpack", category: "Accessories", spec: { fits_laptop_in: 14 }, quantity: 70, uom: "piece", last_cycle_price_inr: 1200, memory_exposed: false },
  { line_no: 4, description: "USB-C docking station", category: "Accessories", spec: { host_interface: "USB-C" }, quantity: 40, uom: "piece", last_cycle_price_inr: 14000, memory_exposed: false },
  { line_no: 5, description: "Lab desktop, Core i5, 16 GB, 512 GB SSD, small form factor", category: "Computing", spec: { form_factor: "small form factor desktop", cpu: "Intel Core i5", ram_gb: 16, ssd_gb: 512 }, quantity: 40, uom: "piece", last_cycle_price_inr: 52000, memory_exposed: true },
  { line_no: 6, description: "Front-desk desktop, Core i3, 8 GB, 256 GB SSD", category: "Computing", spec: { form_factor: "desktop", cpu: "Intel Core i3", ram_gb: 8, ssd_gb: 256 }, quantity: 20, uom: "piece", last_cycle_price_inr: 38000, memory_exposed: true },
  { line_no: 7, description: '24" FHD monitor', category: "Displays", spec: { size_in: 24, resolution: "1920x1080" }, quantity: 60, uom: "piece", last_cycle_price_inr: 9500, memory_exposed: false },
  { line_no: 8, description: '27" QHD monitor', category: "Displays", spec: { size_in: 27, resolution: "2560x1440" }, quantity: 10, uom: "piece", last_cycle_price_inr: 21000, memory_exposed: false },
  { line_no: 9, description: "Wired keyboard and mouse combo", category: "Accessories", spec: { connection: "wired", contents: "keyboard and mouse" }, quantity: 60, uom: "piece", last_cycle_price_inr: 1100, memory_exposed: false },
  { line_no: 10, description: "Wireless keyboard and mouse combo", category: "Accessories", spec: { connection: "wireless", contents: "keyboard and mouse" }, quantity: 70, uom: "piece", last_cycle_price_inr: 2200, memory_exposed: false },
  { line_no: 11, description: "USB headset with mic", category: "Accessories", spec: { connection: "USB", microphone: true }, quantity: 50, uom: "piece", last_cycle_price_inr: 2500, memory_exposed: false },
  { line_no: 12, description: "1080p webcam", category: "Accessories", spec: { resolution: "1080p" }, quantity: 20, uom: "piece", last_cycle_price_inr: 4500, memory_exposed: false },
  { line_no: 13, description: "Mono laser printer, A4, network", category: "Printing and scanning", spec: { technology: "mono laser", paper_size: "A4", network: true }, quantity: 15, uom: "piece", last_cycle_price_inr: 18000, memory_exposed: false },
  { line_no: 14, description: "Colour multifunction printer, A4", category: "Printing and scanning", spec: { technology: "colour multifunction", paper_size: "A4" }, quantity: 5, uom: "piece", last_cycle_price_inr: 45000, memory_exposed: false },
  { line_no: 15, description: "Barcode label printer (specimen labels)", category: "Printing and scanning", spec: { type: "barcode label printer", use: "specimen labels" }, quantity: 20, uom: "piece", last_cycle_price_inr: 22000, memory_exposed: false },
  { line_no: 16, description: "2D barcode scanner", category: "Printing and scanning", spec: { type: "barcode scanner", symbology: "2D" }, quantity: 40, uom: "piece", last_cycle_price_inr: 6500, memory_exposed: false },
  { line_no: 17, description: "Online UPS, 1 kVA", category: "Power", spec: { topology: "online", capacity_kva: 1 }, quantity: 40, uom: "piece", last_cycle_price_inr: 16000, memory_exposed: false },
  { line_no: 18, description: "Online UPS, 3 kVA", category: "Power", spec: { topology: "online", capacity_kva: 3 }, quantity: 6, uom: "piece", last_cycle_price_inr: 55000, memory_exposed: false },
  { line_no: 19, description: "Surge protector, 6 socket", category: "Power", spec: { sockets: 6, surge_protection: true }, quantity: 60, uom: "piece", last_cycle_price_inr: 900, memory_exposed: false },
  { line_no: 20, description: "24-port managed PoE switch", category: "Networking", spec: { ports: 24, managed: true, poe: true }, quantity: 8, uom: "piece", last_cycle_price_inr: 65000, memory_exposed: false },
  { line_no: 21, description: "8-port unmanaged switch", category: "Networking", spec: { ports: 8, managed: false }, quantity: 20, uom: "piece", last_cycle_price_inr: 3500, memory_exposed: false },
  { line_no: 22, description: "Wi-Fi 6 ceiling access point", category: "Networking", spec: { wifi_standard: "Wi-Fi 6 (802.11ax)", mounting: "ceiling" }, quantity: 25, uom: "piece", last_cycle_price_inr: 14000, memory_exposed: false },
  { line_no: 23, description: "Branch firewall (UTM)", category: "Networking", spec: { type: "UTM firewall", deployment: "branch" }, quantity: 4, uom: "piece", last_cycle_price_inr: 90000, memory_exposed: false },
  { line_no: 24, description: "Cat6 patch cable, 2 m", category: "Networking", spec: { cable_category: "Cat6", length_m: 2 }, quantity: 400, uom: "piece", last_cycle_price_inr: 120, memory_exposed: false },
  { line_no: 25, description: "Cat6 cable box, 305 m", category: "Networking", spec: { cable_category: "Cat6", length_m: 305, packaging: "box" }, quantity: 10, uom: "box", last_cycle_price_inr: 9500, memory_exposed: false },
  { line_no: 26, description: "HDMI cable, 1.5 m", category: "Accessories", spec: { length_m: 1.5 }, quantity: 100, uom: "piece", last_cycle_price_inr: 350, memory_exposed: false },
  { line_no: 27, description: "USB-C to HDMI adapter", category: "Accessories", spec: { input: "USB-C", output: "HDMI" }, quantity: 50, uom: "piece", last_cycle_price_inr: 1500, memory_exposed: false },
  { line_no: 28, description: "External SSD, 1 TB", category: "Storage", spec: { type: "external SSD", capacity_gb: 1024 }, quantity: 20, uom: "piece", last_cycle_price_inr: 8500, memory_exposed: true },
  { line_no: 29, description: "NAS, 4-bay (one per hub)", category: "Storage", spec: { bays: 4 }, quantity: 3, uom: "piece", last_cycle_price_inr: 60000, memory_exposed: false },
  { line_no: 30, description: "Wall-mount network rack, 12U", category: "Networking", spec: { height_u: 12, mounting: "wall" }, quantity: 8, uom: "piece", last_cycle_price_inr: 12000, memory_exposed: false },
];

// GSTINs are fictional but well formed, with valid checksums. State is the GST
// registration state: 29 Karnataka, 33 Tamil Nadu. E quotes in USD but invoices
// through its Indian branch in Chennai; customs and importer of record are out of scope.
export const SUPPLIERS = [
  { code: "A", name: "Prakash Distributors", gstin: "29AAKCP4821M1ZV", state: "Karnataka", default_currency: "INR", is_incumbent: true },
  { code: "B", name: "Vertex Systems", gstin: "29AADCV7390R1Z8", state: "Karnataka", default_currency: "INR", is_incumbent: false },
  { code: "C", name: "Nexa Integrators", gstin: "29AAFCN5563K1ZX", state: "Karnataka", default_currency: "INR", is_incumbent: false },
  { code: "D", name: "Sri Ganesh Computers", gstin: "29ABKPG2917D1ZT", state: "Karnataka", default_currency: "INR", is_incumbent: false },
  { code: "E", name: "Lionbridge Tech Trading", gstin: "33AAGCL8104H1ZP", state: "Tamil Nadu", default_currency: "USD", is_incumbent: false },
];

// Illustrative weekly memory price index (Mondays), 1 Jun 2026 = 100.
// Shape: about +11% overall, under 3% after 14 Sep. Tests in tests/seed-data.test.ts pin this.
export const MEMORY_INDEX = {
  series_key: "memory_price_index",
  label: "Memory price index (illustrative, 1 Jun 2026 = 100)",
  unit: "index",
  source: "Illustrative series seeded for the demo",
  points: [
    ["2026-06-01", 100.0],
    ["2026-06-08", 100.3],
    ["2026-06-15", 100.9],
    ["2026-06-22", 101.4],
    ["2026-06-29", 102.2],
    ["2026-07-06", 103.0],
    ["2026-07-13", 103.9],
    ["2026-07-20", 104.7],
    ["2026-07-27", 105.6],
    ["2026-08-03", 106.4],
    ["2026-08-10", 107.1],
    ["2026-08-17", 107.8],
    ["2026-08-24", 108.3],
    ["2026-08-31", 108.8],
    ["2026-09-07", 109.2],
    ["2026-09-14", 109.6],
    ["2026-09-21", 110.4],
    ["2026-09-28", 111.2],
  ] as [string, number][],
};

// Illustrative USD/INR, business days 14 to 30 Sep 2026 (83.10 to 84.60, +1.8%).
export const USD_INR = {
  base_currency: "USD",
  quote_currency: "INR",
  source: "Illustrative rate seeded for the demo",
  points: [
    ["2026-09-14", 83.1],
    ["2026-09-15", 83.14],
    ["2026-09-16", 83.22],
    ["2026-09-17", 83.19],
    ["2026-09-18", 83.35],
    ["2026-09-21", 83.48],
    ["2026-09-22", 83.61],
    ["2026-09-23", 83.57],
    ["2026-09-24", 83.86],
    ["2026-09-25", 83.97],
    ["2026-09-28", 84.22],
    ["2026-09-29", 84.41],
    ["2026-09-30", 84.6],
  ] as [string, number][],
};
