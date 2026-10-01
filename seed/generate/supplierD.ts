// D. Sri Ganesh Computers: a printed rate card dated 4 June 2026, photographed at an
// angle on a counter. 20 of 30 lines, cables per packet of 10, one handwritten
// correction, no validity and no GST mention. Rendered as HTML, then screenshotted.
import { D_HANDWRITTEN, D_PACK_LINE, D_PACK_SIZE, D_RECONFIRMATION, inr, reconfirmedPrice, truePrice } from "./prices";

const ITEMS: [number, string][] = [
  [1, 'Laptop i5 14th Gen / 16GB / 512GB SSD / 14" (Dell Vostro 3440)'],
  [3, "Laptop Backpack 14-15.6\" (Targus)"],
  [4, "USB-C Docking Station (Dell WD19S)"],
  [5, "Desktop SFF i5 14th Gen / 16GB / 512GB SSD (Dell OptiPlex)"],
  [6, "Desktop i3 / 8GB / 256GB SSD (Dell Vostro 3030)"],
  [7, '24" FHD Monitor (LG 24MP400)'],
  [8, '27" QHD Monitor (LG 27QN600)'],
  [9, "Keyboard + Mouse Wired (Logitech MK120)"],
  [10, "Keyboard + Mouse Wireless (Logitech MK270)"],
  [11, "USB Headset with Mic (Logitech H390)"],
  [12, "Webcam 1080p (Logitech C920)"],
  [13, "Laser Printer Mono A4 Network (Brother HL-L2351DW)"],
  [16, "2D Barcode Scanner (Honeywell 1470g)"],
  [19, "Spike Guard 6 Socket"],
  [21, "8 Port Switch Unmanaged (TP-Link)"],
  [24, `Cat6 Patch Cord 2 mtr (${D_PACK_SIZE} pcs)`],
  [25, "Cat6 Cable Box 305 mtr (D-Link)"],
  [26, "HDMI Cable 1.5 mtr"],
  [27, "USB-C to HDMI Adapter"],
  [28, "External SSD 1TB (Samsung T7)"],
];

function priceCell(line: number): string {
  if (line === D_PACK_LINE) return `${inr(truePrice("D", line)! * D_PACK_SIZE)}/pkt`;
  if (line === D_HANDWRITTEN.line) {
    return `<span class="struck">${inr(D_HANDWRITTEN.printed)}/-</span><span class="hand">${inr(D_HANDWRITTEN.corrected)}/-</span>`;
  }
  return `${inr(truePrice("D", line)!)}/-`;
}

// The printed card on its own, without the photo effect.
export function buildRateCardHtml(): string {
  const rows = ITEMS.map(
    ([line, name], i) => `<tr><td>${i + 1}</td><td class="n">${name}</td><td class="p">${priceCell(line)}</td></tr>`,
  ).join("\n");
  return `<div class="card">
  <div class="shop">SRI GANESH COMPUTERS</div>
  <div class="tag">Sales · Service · Networking · Since 2004</div>
  <div class="addr">Shop 7, Ganesh Complex, SP Road, Bengaluru 560002 · Ph: 080 2222 0000</div>
  <div class="title">RATE LIST <span>Date: 04-Jun-2026</span></div>
  <table>
    <thead><tr><th>S.No</th><th>Item</th><th>Rate (Rs.)</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <div class="foot">Goods once sold will not be taken back. Subject to Bengaluru jurisdiction.<br>Bulk orders: rates negotiable. Contact Ganesh.</div>
</div>`;
}

export function buildPhotoHtml(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Sri Ganesh rate card photo</title>
<style>
  html, body { margin: 0; width: 1200px; height: 1600px; overflow: hidden; }
  body {
    background:
      radial-gradient(ellipse at 30% 20%, rgba(255,240,210,.35), transparent 60%),
      repeating-linear-gradient(92deg, #6b4a2f 0 14px, #734f33 14px 22px, #684629 22px 40px),
      #6b4a2f;
  }
  .stage { position: absolute; inset: 0; perspective: 1500px; }
  .card {
    position: absolute; left: 110px; top: 95px; width: 960px; padding: 40px 44px 34px;
    background: linear-gradient(135deg, #fbfaf4 0%, #f3f0e4 55%, #e2ddcb 100%);
    font-family: "Courier New", Courier, monospace; color: #232323;
    transform: rotateX(11deg) rotateY(-1.5deg) rotateZ(0.2deg);
    transform-origin: 50% 60%;
    box-shadow: 28px 38px 45px rgba(0,0,0,.55), 0 0 2px rgba(0,0,0,.4);
    filter: blur(0.9px) contrast(0.93) saturate(0.85);
  }
  .card::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(160deg, rgba(255,255,255,.18) 0%, transparent 38%, rgba(0,0,0,.16) 100%);
  }
  .shop { font-family: Georgia, serif; font-size: 40px; font-weight: bold; text-align: center; letter-spacing: 2px; }
  .tag { text-align: center; font-size: 17px; margin-top: 4px; }
  .addr { text-align: center; font-size: 15px; margin: 6px 0 16px; border-bottom: 2px solid #333; padding-bottom: 10px; }
  .title { display: flex; justify-content: space-between; font-size: 24px; font-weight: bold; margin-bottom: 10px; }
  .title span { font-size: 19px; }
  table { width: 100%; border-collapse: collapse; font-size: 17px; }
  th { border-top: 2px solid #333; border-bottom: 2px solid #333; padding: 6px 4px; text-align: left; }
  td { border-bottom: 1px solid #b5b0a0; padding: 9px 4px; vertical-align: middle; }
  td.n { white-space: nowrap; }
  td.p, th:last-child { text-align: right; white-space: nowrap; }
  .struck { position: relative; color: #444; }
  .struck::after { content: ""; position: absolute; left: -4px; right: -4px; top: 52%; border-top: 3px solid #1b2f8f; transform: rotate(-8deg); }
  .hand { font-family: "Bradley Hand", "Noteworthy", "Marker Felt", cursive; color: #1b2f8f; font-size: 27px; font-weight: bold; margin-left: 10px; display: inline-block; transform: rotate(-6deg) translateY(-6px); }
  .foot { font-size: 14px; margin-top: 16px; }
  .light { position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse at 70% 85%, rgba(0,0,0,.35), transparent 55%), radial-gradient(ellipse at 20% 10%, rgba(255,255,255,.12), transparent 50%); }
  .vignette { position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 220px rgba(0,0,0,.55); }
  .noise { position: absolute; inset: 0; pointer-events: none; opacity: .22; mix-blend-mode: multiply; }
</style></head><body>
<div class="stage">
${buildRateCardHtml()}
</div>
<div class="light"></div>
<svg class="noise" width="1200" height="1600"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
<div class="vignette"></div>
</body></html>`;
}

// The reconfirmation reply: a short email after Priya asks D to reconfirm its prices.
export function buildReconfirmationReplyD(): string {
  const lines = Object.keys(D_RECONFIRMATION.raise_pct).map(Number);
  const name = (line: number) => ITEMS.find(([n]) => n === line)![1];
  return [
    "From: Ganesh R <sriganeshcomputers@example.in>",
    "To: Priya <priya@meridiandiagnostics.example>",
    "Date: Wed, 30 Sep 2026 16:40 +0530",
    "Subject: RE: Price reconfirmation - RFx IT Refresh 2026",
    "",
    "Madam,",
    "",
    "Thank you for your mail. Our rate list dated 04-Jun-2026 is confirmed for all items as on today, except below items where memory and SSD prices have gone up:",
    "",
    ...lines.map((l) => `- ${name(l)}: Rs ${inr(reconfirmedPrice(l)!)}/- per unit (earlier ${inr(truePrice("D", l)!)}/-)`),
    "",
    `All rates are valid for ${D_RECONFIRMATION.validity_days} days from today (30-Sep-2026). Other terms as per our rate list.`,
    "",
    "Regards,",
    "Ganesh R",
    "Sri Ganesh Computers, Bengaluru",
    "",
  ].join("\n");
}
