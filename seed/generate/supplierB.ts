// B. Vertex Systems: letterhead PDF following the RFx line numbers. 28 of 30 lines
// (no firewall, no NAS), a conditional 4% footnote discount, and 28% GST printed on UPS lines.
import { SUPPLIERS } from "../data";
import { B_WRONG_GST_LINES, B_WRONG_GST_RATE, GST_RATE, QUANTITY, SUPPLIER_FACTS, inr, truePrice } from "./prices";

const DESC: Record<number, string> = {
  1: 'Dell Latitude 5450, Intel Core i5 14th Gen, 16 GB DDR5, 512 GB SSD, 14" FHD, 3Y ProSupport',
  2: 'Dell Latitude 7450, Intel Core i7 14th Gen, 32 GB, 1 TB SSD, 14" FHD+, 3Y ProSupport',
  3: 'Dell EcoLoop Pro Backpack 15" (CP5723)',
  4: "Dell Universal Dock UD22 (USB-C)",
  5: "Dell OptiPlex 7020 SFF, Intel Core i5 14th Gen, 16 GB, 512 GB SSD, 3Y ProSupport",
  6: "Dell OptiPlex 7020 Tower, Intel Core i3 14th Gen, 8 GB, 256 GB SSD, 3Y ProSupport",
  7: 'Dell 24 Monitor P2425H, 24" FHD IPS',
  8: 'Dell 27 Monitor S2721DS, 27" QHD IPS',
  9: "Dell Wired Keyboard & Mouse KM300C",
  10: "Dell Wireless Keyboard & Mouse KM3322W",
  11: "Dell Wired Headset WH3024 (USB)",
  12: "Logitech C920 HD Pro Webcam, 1080p",
  13: "HP LaserJet Pro 4003dn, Mono, A4, Network",
  14: "HP Color LaserJet Pro MFP 4303fdw, A4",
  15: "Zebra ZD421t Thermal Transfer Label Printer",
  16: "Honeywell Voyager 1470g 2D Scanner, USB",
  17: "APC Easy UPS On-Line SRV1KI, 1 kVA",
  18: "APC Easy UPS On-Line SRV3KI, 3 kVA",
  19: "APC Essential SurgeArrest 6 Outlet, P6-IN",
  20: "Dell Networking N1524P, 24x 1GbE PoE+, Managed",
  21: "Netgear GS308, 8-Port Gigabit Unmanaged",
  22: "Aruba Instant On AP22, Wi-Fi 6, Ceiling Mount",
  24: "Cat6 UTP Patch Cable, 2 m",
  25: "Cat6 UTP Cable, 305 m Box",
  26: "HDMI 2.0 Cable, 1.5 m",
  27: "Dell USB-C to HDMI 2.0 Adapter",
  28: "Samsung T7 Portable SSD, 1 TB",
  30: "Netrack 12U Wall Mount Rack",
};

export function buildSupplierBHtml(): string {
  const b = SUPPLIERS[1];
  const f = SUPPLIER_FACTS.B;
  const lines = Object.keys(DESC).map(Number);
  let subtotal = 0;
  let gst = 0;
  const rows = lines
    .map((n, i) => {
      const unit = truePrice("B", n)!;
      const qty = QUANTITY[n];
      const amount = unit * qty;
      const rate = B_WRONG_GST_LINES.includes(n) ? B_WRONG_GST_RATE : GST_RATE;
      subtotal += amount;
      gst += amount * rate;
      return `<tr><td>${i + 1}</td><td>${n}</td><td class="d">${DESC[n]}</td><td>${qty}</td><td class="r">${inr(unit, 2)}</td><td>${Math.round(rate * 100)}%</td><td class="r">${inr(amount, 2)}</td></tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Vertex Systems Quotation ${f.quote_ref}</title>
<style>
  @page { size: A4; margin: 14mm 12mm 16mm; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 9.5pt; color: #1b1b1b; }
  .lh { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0b4a8b; padding-bottom: 6px; }
  .brand { font-size: 22pt; font-weight: 800; color: #0b4a8b; letter-spacing: 1px; }
  .brand small { display: block; font-size: 8.5pt; font-weight: 500; color: #555; letter-spacing: 0; }
  .addr { text-align: right; font-size: 8pt; color: #444; line-height: 1.4; }
  h1 { font-size: 13pt; margin: 14px 0 6px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; font-size: 9pt; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0b4a8b; color: #fff; font-weight: 600; padding: 4px; font-size: 8.5pt; }
  td { border-bottom: 1px solid #ddd; padding: 3px 4px; text-align: center; font-size: 8.5pt; }
  td.d { text-align: left; } td.r, th.r { text-align: right; }
  tr { page-break-inside: avoid; }
  .tot td { border: none; font-weight: 600; }
  .fn { margin-top: 8px; font-size: 8pt; }
  .terms { margin-top: 12px; font-size: 8.5pt; } .terms li { margin: 2px 0; }
  .sign { margin-top: 18px; font-size: 9pt; }
</style></head><body>
<div class="lh">
  <div class="brand">VERTEX SYSTEMS<small>Vertex Systems Pvt Ltd · Authorised Dell Technologies Partner</small></div>
  <div class="addr">4th Floor, Lakshmi Towers, MG Road, Bengaluru 560001<br>GSTIN ${b.gstin} · +91 80 4100 0000<br>quotes@vertexsystems.example</div>
</div>
<h1>QUOTATION</h1>
<div class="meta">
  <div><b>To:</b> Priya, Category Buyer, Meridian Diagnostics</div><div><b>Quotation no.:</b> ${f.quote_ref}</div>
  <div><b>Subject:</b> RFx IT Refresh 2026</div><div><b>Date:</b> 24 September 2026</div>
  <div><b>Delivery:</b> Bengaluru, Chennai, Hyderabad hubs</div><div><b>Validity:</b> 7 days (valid till 01-Oct-2026)</div>
</div>
<table>
<thead><tr><th>Sl</th><th>RFx line</th><th>Description</th><th>Qty</th><th class="r">Unit price (₹, excl. GST)</th><th>GST</th><th class="r">Amount (₹, excl. GST)</th></tr></thead>
<tbody>
${rows}
<tr class="tot"><td colspan="6" class="r">Sub-total (excl. GST)<sup>*</sup></td><td class="r">${inr(subtotal, 2)}</td></tr>
<tr class="tot"><td colspan="6" class="r">GST</td><td class="r">${inr(gst, 2)}</td></tr>
<tr class="tot"><td colspan="6" class="r">Grand total (incl. GST)</td><td class="r">${inr(subtotal + gst, 2)}</td></tr>
</tbody></table>
<p class="fn"><sup>*</sup> Additional 4% discount on orders above ₹25 lakh.</p>
<p class="fn">Not quoted: RFx line 23 (branch firewall) and line 29 (4-bay NAS).</p>
<div class="terms"><b>Terms</b><ul>
  <li>Prices are per unit, excluding GST. GST as shown per line.</li>
  <li>Delivery within 10 days of PO to all three hubs; freight included.</li>
  <li>Warranty: 3 years Dell ProSupport onsite across India, including Bengaluru, Chennai and Hyderabad. Warranty letter attached.</li>
  <li>Payment: 30 days from invoice.</li>
  <li>Compliance: ISO 9001 certificate, Dell authorisation letter and warranty letter attached. Delivery within 21 days: yes. E-waste take-back through Dell Asset Recovery: yes. Escalation contact: Kavitha Rao, Sales Director, +91 98450 00000. Healthcare references: Kaveri Diagnostics, Mysuru; Coastal Care Hospitals, Mangaluru.</li>
</ul></div>
<div class="sign">For Vertex Systems Pvt Ltd<br><br><b>Arvind Menon</b><br>Key Account Manager</div>
</body></html>`;
}
