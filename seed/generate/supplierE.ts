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
