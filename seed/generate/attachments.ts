// Supporting documents: ISO 9001 certificates (A, B valid; C expired March 2026),
// OEM authorisation letters (A, B) and B's warranty letter. Third-party documents use
// a fictional registrar, carry no real logos and are marked as fictional demo documents.
import { SUPPLIERS } from "../data";

const FICTIONAL = "Fictional document generated for the QuoteLens demo. Not a real certificate or letter.";

const BASE_CSS = `
  @page { size: A4; margin: 20mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1c1c1c; font-size: 11pt; line-height: 1.5; }
  .fict { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-family: Arial, sans-serif; font-size: 7.5pt; color: #888; }
`;

type IsoInput = { supplierIndex: number; certNo: string; issued: string; validUntil: string; scope: string; address: string };

export function isoCertificateHtml({ supplierIndex, certNo, issued, validUntil, scope, address }: IsoInput): string {
  const s = SUPPLIERS[supplierIndex];
  return `<!doctype html><html><head><meta charset="utf-8"><title>ISO 9001 certificate ${certNo}</title><style>${BASE_CSS}
  .frame { border: 6px double #7a5c1e; padding: 34px 40px; height: 225mm; box-sizing: border-box; text-align: center; }
  .reg { font-family: Arial, sans-serif; letter-spacing: 3px; font-size: 10pt; color: #7a5c1e; }
  h1 { font-size: 28pt; margin: 18px 0 4px; } h2 { font-size: 14pt; font-weight: normal; margin: 0 0 26px; }
  .org { font-size: 20pt; font-weight: bold; margin: 12px 0 4px; }
  .grid { margin: 30px auto 0; text-align: left; width: 80%; font-size: 11pt; } .grid td { padding: 4px 10px; }
  .sig { margin-top: 46px; display: flex; justify-content: space-around; font-size: 10pt; }
  </style></head><body>
  <div class="frame">
    <div class="reg">DECCAN QUALITY CERTIFICATION PVT LTD</div>
    <h1>CERTIFICATE</h1>
    <h2>of Quality Management System Registration</h2>
    <div>This is to certify that the quality management system of</div>
    <div class="org">${s.name}</div>
    <div>${address}</div>
    <p>has been assessed and found to conform to the requirements of</p>
    <div class="org">ISO 9001:2015</div>
    <p>for the following scope:<br><i>${scope}</i></p>
    <table class="grid">
      <tr><td>Certificate no.</td><td><b>${certNo}</b></td></tr>
      <tr><td>Date of issue</td><td>${issued}</td></tr>
      <tr><td>Valid until</td><td><b>${validUntil}</b></td></tr>
    </table>
    <p style="font-size:9pt;margin-top:22px">Validity of this certificate is subject to successful annual surveillance audits.</p>
    <div class="sig"><div>______________________<br>Lead Auditor</div><div>______________________<br>Director, Certification</div></div>
  </div>
  <div class="fict">${FICTIONAL}</div>
  </body></html>`;
}

type LetterInput = { from: string; fromAddress: string; date: string; title: string; paragraphs: string[]; signatory: string; role: string };

export function letterHtml({ from, fromAddress, date, title, paragraphs, signatory, role }: LetterInput): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${BASE_CSS}
  .head { border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 24px; }
  .head b { font-family: Arial, sans-serif; font-size: 15pt; letter-spacing: 1px; } .head div { font-size: 9pt; color: #555; }
  h3 { text-decoration: underline; margin: 22px 0 14px; }
  </style></head><body>
  <div class="head"><b>${from}</b><div>${fromAddress}</div></div>
  <p>Date: ${date}</p>
  <p>To<br>Meridian Diagnostics<br>Procurement Department, Bengaluru</p>
  <h3>${title}</h3>
  ${paragraphs.map((p) => `<p>${p}</p>`).join("\n")}
  <p style="margin-top:40px">Yours faithfully,<br><br><br><b>${signatory}</b><br>${role}<br>${from}</p>
  <div class="fict">${FICTIONAL}</div>
  </body></html>`;
}

export const ATTACHMENTS = {
  A_ISO: () =>
    isoCertificateHtml({
      supplierIndex: 0,
      certNo: "DQC/QMS/24/1187",
      issued: "10 May 2024",
      validUntil: "9 May 2027",
      scope: "Distribution, supply and after-sales support of IT hardware and peripherals",
      address: "No. 14, 2nd Cross, SP Road, Bengaluru 560002, Karnataka",
    }),
  B_ISO: () =>
    isoCertificateHtml({
      supplierIndex: 1,
      certNo: "DQC/QMS/23/0954",
      issued: "20 November 2023",
      validUntil: "19 November 2026",
      scope: "Sales, integration and support of IT infrastructure solutions",
      address: "4th Floor, Lakshmi Towers, MG Road, Bengaluru 560001, Karnataka",
    }),
  C_ISO: () =>
    isoCertificateHtml({
      supplierIndex: 2,
      certNo: "DQC/QMS/23/0311",
      issued: "15 March 2023",
      validUntil: "14 March 2026",
      scope: "System integration, supply and maintenance of IT and networking equipment",
      address: "No. 88, 5th Main, HSR Layout Sector 6, Bengaluru 560102, Karnataka",
    }),
  E_ISO: () =>
    isoCertificateHtml({
      supplierIndex: 4,
      certNo: "DQC/QMS/25/0142",
      issued: "12 February 2025",
      validUntil: "11 February 2028",
      scope: "Trading, supply and after-sales coordination of IT hardware, including its India branch in Chennai",
      address: "Singapore, with India branch at Anna Salai, Chennai 600002, Tamil Nadu",
    }),
  E_OEM: () =>
    letterHtml({
      from: "HP India Partner Programme (South)",
      fromAddress: "Chennai, Tamil Nadu",
      date: "15 June 2026",
      title: "Manufacturer Authorisation Letter",
      paragraphs: [
        `We confirm that <b>${SUPPLIERS[4].name} Pte Ltd</b>, through its India branch in Chennai (GSTIN ${SUPPLIERS[4].gstin}), is an authorised partner for HP notebooks, desktops, monitors and accessories supplied in India.`,
        "Products supplied through this partner carry the standard HP India warranty, with onsite service available in Bengaluru, Chennai and Hyderabad.",
        "This authorisation is valid until 30 June 2027.",
      ],
      signatory: "Partner Business Manager",
      role: "South India",
    }),
  A_OEM: () =>
    letterHtml({
      from: "Lenovo India Channel Programme (South)",
      fromAddress: "Bengaluru, Karnataka",
      date: "1 August 2026",
      title: "Manufacturer Authorisation Letter",
      paragraphs: [
        `We confirm that <b>${SUPPLIERS[0].name}</b>, Bengaluru (GSTIN ${SUPPLIERS[0].gstin}), is an authorised channel partner for Lenovo ThinkPad notebooks and accessories in Karnataka, Tamil Nadu and Telangana.`,
        "Products supplied through this partner carry the standard Lenovo India warranty, with onsite service available in Bengaluru, Chennai and Hyderabad.",
        "This authorisation is valid until 31 March 2027.",
      ],
      signatory: "Channel Account Manager",
      role: "South India",
    }),
  B_OEM: () =>
    letterHtml({
      from: "Dell Technologies India Partner Programme",
      fromAddress: "Bengaluru, Karnataka",
      date: "3 July 2026",
      title: "Manufacturer Authorisation Letter",
      paragraphs: [
        `We confirm that <b>${SUPPLIERS[1].name} Pvt Ltd</b>, Bengaluru (GSTIN ${SUPPLIERS[1].gstin}), is an authorised partner for Dell Latitude notebooks, OptiPlex desktops, Dell monitors, accessories and Dell Networking switches.`,
        "Products supplied through this partner are eligible for Dell ProSupport onsite service across India.",
        "This authorisation is valid until 31 January 2027.",
      ],
      signatory: "Partner Account Manager",
      role: "Karnataka",
    }),
  B_WARRANTY: () =>
    letterHtml({
      from: "Vertex Systems Pvt Ltd",
      fromAddress: `4th Floor, Lakshmi Towers, MG Road, Bengaluru 560001 · GSTIN ${SUPPLIERS[1].gstin}`,
      date: "24 September 2026",
      title: "Warranty Undertaking: Quotation VS/Q/2026/0917",
      paragraphs: [
        "We undertake that all Dell laptops and desktops supplied against our quotation VS/Q/2026/0917 will carry 3 years of Dell ProSupport with next-business-day onsite service in India.",
        "Onsite service is available at Meridian Diagnostics' hubs and centres in Bengaluru, Chennai and Hyderabad. Monitors and accessories carry the standard OEM warranty, serviced through Vertex Systems.",
        "UPS units carry a 2-year warranty from APC, serviced onsite in all three cities.",
      ],
      signatory: "Arvind Menon",
      role: "Key Account Manager",
    }),
};
