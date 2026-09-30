// C. Nexa Integrators: a Word proposal with every commercial written in prose.
// Two substitutes (line 1: 13th-gen i5; line 22: Wi-Fi 5 AP), freight at actuals for
// Chennai and Hyderabad, and an expired ISO certificate attached separately.
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { SUPPLIERS } from "../data";
import { C_SUBSTITUTES, QUANTITY, SUPPLIER_FACTS, inr, truePrice } from "./prices";

const p = (n: number) => `₹${inr(truePrice("C", n)!)}`;

function para(text: string, opts: { bold?: boolean; spacingAfter?: number } = {}) {
  return new Paragraph({
    spacing: { after: opts.spacingAfter ?? 160, line: 300 },
    children: [new TextRun({ text, bold: opts.bold, font: "Calibri", size: 22 })],
  });
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: "Calibri", size: 26, bold: true, color: "1F4E79" })],
  });
}

export async function buildSupplierC(): Promise<Buffer> {
  const c = SUPPLIERS[2];
  const f = SUPPLIER_FACTS.C;

  const body = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "NEXA INTEGRATORS PVT LTD", bold: true, font: "Calibri", size: 28, color: "1F4E79" })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 240 },
      children: [new TextRun({ text: `No. 88, 5th Main, HSR Layout Sector 6, Bengaluru 560102 · GSTIN ${c.gstin}`, font: "Calibri", size: 18, color: "555555" })],
    }),
    para(`Ref: ${f.quote_ref}`),
    para("26 September 2026"),
    para("To Priya, Category Buyer, Meridian Diagnostics, Bengaluru"),
    para("Subject: Commercial proposal for your IT Refresh 2026", { bold: true }),
    para("Dear Priya,"),
    para(
      "Thank you for inviting Nexa Integrators to quote for Meridian's IT refresh across your Bengaluru, Chennai and Hyderabad hubs. We have gone through the specification and set out our commercial proposal below. All prices are per unit and exclude GST, which will be charged extra at 18%.",
    ),

    heading("Computing"),
    para(
      `For the ${QUANTITY[1]} business laptops, 14th Gen Core i5 stock is on long allocation with our distributors, so we propose the ${C_SUBSTITUTES[1].offered}, at ${p(1)} per unit. We believe it is fully adequate for your staff workloads. For the ${QUANTITY[2]} management laptops we offer the HP EliteBook 840 G11 with Core i7 (14th Gen), 32 GB and a 1 TB SSD at ${p(2)} each, and each laptop user will get an HP Prelude 15.6-inch backpack at ${p(3)}.`,
    ),
    para(
      `The ${QUANTITY[5]} lab desktops will be the HP Pro SFF 400 G9 (Core i5 14th Gen, 16 GB, 512 GB SSD) at ${p(5)} per unit, and the ${QUANTITY[6]} front-desk machines the HP Pro Tower 280 G9 (Core i3, 8 GB, 256 GB SSD) at ${p(6)}. For docking, the HP USB-C Dock G5 is priced at ${p(4)}.`,
    ),

    heading("Displays and accessories"),
    para(
      `We propose HP P24 G5 24-inch FHD monitors at ${p(7)} and HP E27q G5 27-inch QHD monitors at ${p(8)}. Keyboard and mouse sets come to ${p(9)} for the wired HP 225 combo and ${p(10)} for the wireless HP 235 combo. The Poly Blackwire 3320 USB headset is ${p(11)}, and the HP 320 FHD webcam is ${p(12)}.`,
    ),
    para(
      `For cabling at the desks, 1.5 m HDMI cables are ${p(26)} each and HP USB-C to HDMI adapters are ${p(27)} each. The Samsung T7 1 TB external SSDs are ${p(28)} each, and for the hubs we offer the Synology DS923+ 4-bay NAS at ${p(29)} per unit, one per hub.`,
    ),

    heading("Printing, scanning and power"),
    para(
      `The mono network printer will be the HP LaserJet Pro 4003dn at ${p(13)}, and the colour multifunction unit the HP Color LaserJet Pro MFP 4303fdw at ${p(14)}. For specimen labels we recommend the Zebra ZD421t at ${p(15)} and the Zebra DS2208 2D scanner at ${p(16)}.`,
    ),
    para(
      `Online UPS units are from APC: the 1 kVA model at ${p(17)} and the 3 kVA model at ${p(18)}. Six-socket surge protectors are ${p(19)} each.`,
    ),

    heading("Networking"),
    para(
      `Core switching is the Aruba Instant On 1930 24-port PoE managed switch at ${p(20)}, with TP-Link 8-port unmanaged switches at ${p(21)}. For wireless we propose the ${C_SUBSTITUTES[22].offered} at ${p(22)} per access point, which gives very good coverage for clinic floor plans at a lower cost. Branch firewalls will be the Fortinet FortiGate 40F with one year of UTM licensing at ${p(23)}.`,
    ),
    para(
      `Passive items: 2 m Cat6 patch cords at ${p(24)} each, Cat6 cable at ${p(25)} per 305 m box, and 12U wall-mount racks at ${p(30)} each.`,
    ),

    heading("Commercial terms"),
    para(
      "Prices are valid for 15 days from the date of this letter. Freight to the Bengaluru hub is included in the prices above; freight to Chennai and Hyderabad will be charged at actuals. We will deliver to all three hubs within 21 days of your purchase order. Payment terms are 45 days from invoice.",
    ),
    para(
      "All hardware carries a 3-year onsite warranty, and our service partners cover Bengaluru, Chennai and Hyderabad. We are an authorised partner for HP and Aruba in Karnataka. We offer e-waste take-back for replaced equipment through a registered recycler. Our ISO 9001 certificate is attached.",
    ),
    para(
      "Your escalation contact is Deepak Iyer, Head of Sales, on +91 99000 00000. For healthcare references, please speak to Kaveri Diagnostics in Mysuru and Lotus Fertility Centres in Bengaluru.",
    ),
    para("We look forward to working with Meridian."),
    para("Warm regards,"),
    para("Suresh Nair", { bold: true, spacingAfter: 0 }),
    para("Director, Nexa Integrators Pvt Ltd"),
  ];

  const doc = new Document({
    creator: "Nexa Integrators",
    title: "Commercial proposal: Meridian Diagnostics IT Refresh 2026",
    sections: [{ properties: {}, children: body }],
  });
  return Packer.toBuffer(doc);
}
