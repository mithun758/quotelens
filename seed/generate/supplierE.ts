// E. Lionbridge Tech Trading: a short email, 14 Sep, six lines in USD, "all other items
// same as last year's rates", freight extra, no India warranty mention, declines 17, 18, 23.
import { SUPPLIERS } from "../data";
import { E_USD } from "./prices";

const usd = (n: number) => `USD ${E_USD[n].toFixed(2)}`;

export function buildSupplierE(): string {
  const e = SUPPLIERS[4];
  return `From: Daniel Tan <daniel.tan@lionbridgetech.example>
To: Priya <priya@meridiandiagnostics.example>
Date: Mon, 14 Sep 2026 12:00 +0800
Subject: RE: RFx IT Refresh 2026 - Meridian Diagnostics

Hi Priya,

Thanks for the RFQ. Our prices for this round:

- Business laptop i5 14th gen, 16GB/512GB, 14": ${usd(1)}
- Management laptop i7, 32GB/1TB, 14": ${usd(2)}
- USB-C dock: ${usd(4)}
- 24" FHD monitor: ${usd(7)}
- 27" QHD monitor: ${usd(8)}
- 1080p webcam: ${usd(12)}

All other items same as last year's rates. We can't quote the UPS units (1 kVA and 3 kVA) or the branch firewall this time.

Prices per unit, exclusive of GST, valid 30 days. Freight extra.

Best regards,
Daniel Tan
Regional Sales, ${e.name} Pte Ltd, Singapore
India branch: Chennai | GSTIN ${e.gstin}
`;
}

// Seeded reply to Priya's clarification. Not loaded at seed time: the clarification
// loop re-extracts it with the model when Priya asks E. It confirms India warranty,
// declines 17, 18 and 23, answers the questionnaire and attaches ISO and OEM evidence.
export function buildClarificationReplyE(): string {
  const e = SUPPLIERS[4];
  return `From: Daniel Tan <daniel.tan@lionbridgetech.example>
To: Priya <priya@meridiandiagnostics.example>
Date: Wed, 30 Sep 2026 11:05 +0800
Subject: RE: Clarification - India warranty and lines 17, 18, 23 - RFx IT Refresh 2026
Attachments: Lionbridge_ISO_9001_Certificate.pdf, Lionbridge_OEM_Authorisation_HP.pdf

Hi Priya,

Confirming India warranty: every item we have quoted, including the laptops, carries a 3-year onsite warranty in India, serviced in Bengaluru, Chennai and Hyderabad through our Chennai branch and HP's authorised service network.

We are not able to quote the UPS units (lines 17 and 18) or the branch firewall (line 23).

To complete your questionnaire:
- ISO 9001: certificate attached.
- OEM authorisation: HP authorisation letter attached.
- Delivery: within 18 days of PO to all three hubs.
- GST: registered in Tamil Nadu, GSTIN ${e.gstin}.
- E-waste take-back: yes, through our authorised recycler in Chennai.
- Escalation contact: Mei Ling Goh, Country Manager India, +91 44 4000 0000.
- Healthcare references: Coastal Care Hospitals, Chennai; Deccan Pathology Labs, Hyderabad.

Our prices and other terms are as in my email of 14 September.

Best regards,
Daniel Tan
Regional Sales, ${e.name} Pte Ltd, Singapore
India branch: Chennai | GSTIN ${e.gstin}
`;
}
