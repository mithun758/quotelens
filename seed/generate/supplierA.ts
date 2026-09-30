// A. Prakash Distributors: an Excel workbook that ignores the RFx template.
// Merged headers, subtotal rows, OEM SKU names, no RFx line numbers, a laptop +
// backpack bundle, and a Networking sheet that is GST-inclusive while the rest are ex-GST.
import * as XLSX from "xlsx";
import { SUPPLIERS } from "../data";
import {
  A_BUNDLE_QTY,
  A_EXTRA_BACKPACKS,
  GST_RATE,
  QUANTITY,
  SUPPLIER_FACTS,
  truePrice,
} from "./prices";

const SKU: Record<number, string> = {
  2: 'HP EliteBook 840 G11 | Core i7 14th Gen / 32GB DDR5 / 1TB SSD / 14" | 9G1Q4PA',
  4: "Lenovo ThinkPad Universal USB-C Dock | 40AY0090IN",
  5: "HP Pro SFF 400 G9 | Core i5 14th Gen / 16GB / 512GB SSD | 8T2L7PA",
  6: "HP Pro Tower 280 G9 | Core i3 14th Gen / 8GB / 256GB SSD | 8T2M1PA",
  7: 'Dell P2425H 24" FHD IPS Monitor | 210-BMJB',
  8: 'Dell P2723DE 27" QHD USB-C Monitor | 210-BDZT',
  9: "Logitech MK120 Wired Keyboard + Mouse | 920-002586",
  10: "Logitech MK270 Wireless Combo | 920-004536",
  11: "Jabra Evolve2 30 USB-A Stereo Headset | 23089-989-979",
  12: "Logitech C920 HD Pro 1080p Webcam | 960-001055",
  13: "HP LaserJet Pro 4003dn Mono A4 Network | 2Z609A",
  14: "HP Color LaserJet Pro MFP 4303fdw | 5HH67A",
  15: "TSC TE244 Thermal Transfer Label Printer | 99-065A301",
  16: "Zebra DS2208 2D Imager, USB | DS2208-SR7U2100AZW",
  17: "APC Easy UPS On-Line 1kVA | SRV1KI",
  18: "APC Easy UPS On-Line 3kVA | SRV3KI",
  19: "Belkin 6-Socket Surge Protector | F9H620",
  20: "Aruba Instant On 1930 24G Class4 PoE 4SFP/SFP+ 370W | JL684A",
  21: "TP-Link TL-SG108 8-Port Gigabit Unmanaged | TL-SG108",
  22: "Aruba Instant On AP22 Wi-Fi 6 Indoor AP | R4W02A",
  23: "Fortinet FortiGate 40F + 1yr UTP Bundle | FG-40F-BDL-950-12",
  24: "D-Link Cat6 UTP Patch Cord 2m Grey | NCB-C6UGRYR-2",
  25: "D-Link Cat6 UTP Cable 305m Box | NCB-C6UGRYR-305",
  26: "Belkin High Speed HDMI Cable 1.5m | F3Y017bt1.5M",
  27: "Belkin USB-C to HDMI Adapter 4K | AVC002btBK",
  28: "Samsung T7 Portable SSD 1TB | MU-PC1T0T/WW",
  29: "Synology DiskStation DS923+ 4-Bay (diskless) | DS923+",
  30: "Netrack 12U Wall Mount Rack 600x450 | 125-500-120-012",
};
const BUNDLE_SKU =
  'Lenovo ThinkPad E14 Gen 6 | Core i5 14th Gen / 16GB / 512GB SSD / 14" WUXGA | 21M7S0KX00 + ThinkPad Essential 14" Backpack | 4X41C12468 (BUNDLE)';
const BACKPACK_SKU = 'ThinkPad Essential 14" Backpack (additional) | 4X41C12468';

const INR_FMT = "#,##,##0.00";

type Row = { sku: string; qty: number; unit: number; remark?: string };
type Group = { title: string; rows: Row[] };

function row(line: number, remark?: string, inclusive = false): Row {
  const price = truePrice("A", line)!;
  const unit = inclusive ? Math.round(price * (1 + GST_RATE) * 100) / 100 : price;
  return { sku: SKU[line], qty: QUANTITY[line], unit, remark };
}

function buildSheet(title: string, priceHeader: string, groups: Group[], footnote?: string) {
  const a = SUPPLIERS[0];
  const f = SUPPLIER_FACTS.A;
  const aoa: (string | number | null)[][] = [
    ["PRAKASH DISTRIBUTORS", null, null, null, null, null],
    [`No. 14, 2nd Cross, SP Road, Bengaluru 560002  |  GSTIN ${a.gstin}  |  sales@prakashdistributors.example`, null, null, null, null, null],
    [`QUOTATION   Ref: ${f.quote_ref}   Date: 22-Sep-2026   To: Meridian Diagnostics, IT Refresh 2026   Sheet: ${title}`, null, null, null, null, null],
    [null, null, null, null, null, null],
    ["Sl", "Product / OEM SKU", "Qty", priceHeader, null, "Remarks"],
    [null, null, null, "Unit", "Total", null],
  ];
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
    { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
    { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } },
    { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } },
    { s: { r: 4, c: 3 }, e: { r: 4, c: 4 } },
    { s: { r: 4, c: 5 }, e: { r: 5, c: 5 } },
  ];
  const formulas: { r: number; f: string; v: number }[] = [];
  let sl = 1;
  const subtotalRows: { r: number; v: number }[] = [];

  for (const g of groups) {
    aoa.push([null, g.title.toUpperCase(), null, null, null, null]);
    const first = aoa.length;
    for (const r of g.rows) {
      const total = Math.round(r.qty * r.unit * 100) / 100;
      formulas.push({ r: aoa.length, f: `C${aoa.length + 1}*D${aoa.length + 1}`, v: total });
      aoa.push([sl++, r.sku, r.qty, r.unit, total, r.remark ?? null]);
    }
    const last = aoa.length - 1;
    const sub = g.rows.reduce((s, r) => s + Math.round(r.qty * r.unit * 100) / 100, 0);
    formulas.push({ r: aoa.length, f: `SUM(E${first + 1}:E${last + 1})`, v: sub });
    subtotalRows.push({ r: aoa.length, v: sub });
    aoa.push([null, `Sub-total: ${g.title}`, null, null, sub, null]);
    aoa.push([null, null, null, null, null, null]);
  }
  const sheetTotal = subtotalRows.reduce((s, r) => s + r.v, 0);
  formulas.push({ r: aoa.length, f: subtotalRows.map((s) => `E${s.r + 1}`).join("+"), v: sheetTotal });
  aoa.push([null, `SHEET TOTAL: ${title}`, null, null, sheetTotal, null]);
  if (footnote) {
    aoa.push([null, null, null, null, null, null]);
    aoa.push([footnote, null, null, null, null, null]);
    merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 5 } });
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 5 }, { wch: 78 }, { wch: 7 }, { wch: 14 }, { wch: 16 }, { wch: 34 }];
  for (const f of formulas) {
    const addr = XLSX.utils.encode_cell({ r: f.r, c: 4 });
    ws[addr] = { t: "n", v: f.v, f: f.f, z: INR_FMT };
  }
  for (let r = 6; r < aoa.length; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 3 });
    if (ws[addr]?.t === "n") ws[addr].z = INR_FMT;
  }
  return { ws, total: sheetTotal };
}

export function buildSupplierA(): Buffer {
  const laptop = truePrice("A", 1)!;
  const backpack = truePrice("A", 3)!;

  const computing = buildSheet("Computing", "Price (₹, excl. GST)", [
    {
      title: "Laptops",
      rows: [
        { sku: BUNDLE_SKU, qty: A_BUNDLE_QTY, unit: laptop + backpack, remark: "Bundle price: laptop + backpack" },
        row(2),
      ],
    },
    { title: "Desktops", rows: [row(5, "SFF, lab use"), row(6)] },
  ]);
  const peripherals = buildSheet("Peripherals & Storage", "Price (₹, excl. GST)", [
    { title: "Displays", rows: [row(7), row(8)] },
    {
      title: "Accessories",
      rows: [
        { sku: BACKPACK_SKU, qty: A_EXTRA_BACKPACKS, unit: backpack, remark: "Balance qty; 60 included in laptop bundle" },
        row(4), row(9), row(10), row(11), row(12), row(26), row(27),
      ],
    },
    { title: "Storage", rows: [row(28), row(29, "One per hub")] },
  ]);
  const printPower = buildSheet("Print & Power", "Price (₹, excl. GST)", [
    { title: "Printing & Scanning", rows: [row(13), row(14), row(15, "Specimen labels"), row(16)] },
    { title: "Power", rows: [row(17), row(18), row(19)] },
  ]);
  const networking = buildSheet(
    "Networking",
    "Price (₹, incl. GST @18%)",
    [
      { title: "Switching & Wireless", rows: [row(20, undefined, true), row(21, undefined, true), row(22, undefined, true)] },
      { title: "Security", rows: [row(23, "Incl. 1 year UTP licence", true)] },
      { title: "Passive", rows: [row(24, undefined, true), row(25, "Per box", true), row(30, undefined, true)] },
    ],
    "Note: all prices on this sheet are INCLUSIVE of GST @ 18%.",
  );

  const f = SUPPLIER_FACTS.A;
  const summary = XLSX.utils.aoa_to_sheet([
    ["PRAKASH DISTRIBUTORS: QUOTATION SUMMARY"],
    [`Ref: ${f.quote_ref}   Date: 22-Sep-2026   Customer: Meridian Diagnostics`],
    [],
    ["Sheet", "Amount (₹)"],
    ["Computing", computing.total],
    ["Peripherals & Storage", peripherals.total],
    ["Print & Power", printPower.total],
    ["Networking", networking.total],
    ["GRAND TOTAL", computing.total + peripherals.total + printPower.total + networking.total],
    [],
    ["GST extra as applicable (Networking sheet already inclusive)."],
  ]);
  summary["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];
  summary["!cols"] = [{ wch: 44 }, { wch: 18 }];
  for (let r = 4; r <= 8; r++) summary[XLSX.utils.encode_cell({ r, c: 1 })].z = INR_FMT;

  const terms = XLSX.utils.aoa_to_sheet([
    ["TERMS & CONDITIONS"],
    [],
    ["Quotation ref", f.quote_ref],
    ["Date", "22-Sep-2026"],
    ["Validity", "30 days from date of quotation"],
    ["Prices", "Ex-GST; GST extra as applicable. Networking sheet prices include GST @ 18%."],
    ["Delivery", "Within 14 days of PO to Bengaluru, Chennai and Hyderabad hubs"],
    ["Freight", "Free delivery to all three hubs"],
    ["Warranty", "3 years OEM onsite warranty, service in Bengaluru, Chennai and Hyderabad"],
    ["Payment", "45 days from invoice"],
    [],
    ["COMPLIANCE"],
    ["ISO 9001", "Yes, certificate attached"],
    ["OEM authorisation", "Yes, Lenovo authorisation letter attached"],
    ["India warranty, onsite in all 3 cities", "Yes"],
    ["Delivery within 21 days", "Yes, 14 days"],
    ["GST registration", `Yes, GSTIN ${SUPPLIERS[0].gstin}`],
    ["E-waste take-back", "Yes, through authorised recycler"],
    ["Escalation contact", "Ramesh Prakash, Director, +91 80 4000 0000"],
    ["Healthcare references", "Kaveri Diagnostics, Mysuru; Nandi Clinic Group, Bengaluru"],
  ]);
  terms["!cols"] = [{ wch: 38 }, { wch: 90 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summary, "Summary");
  XLSX.utils.book_append_sheet(wb, computing.ws, "Computing");
  XLSX.utils.book_append_sheet(wb, peripherals.ws, "Peripherals & Storage");
  XLSX.utils.book_append_sheet(wb, printPower.ws, "Print & Power");
  XLSX.utils.book_append_sheet(wb, networking.ws, "Networking");
  XLSX.utils.book_append_sheet(wb, terms, "Terms");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
