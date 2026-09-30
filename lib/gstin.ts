// GSTIN: 2-digit state code, 10-char PAN, entity number, 'Z', check character.
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Only the states this demo touches: supplier registrations and delivery hubs.
export const GST_STATE_CODES: Record<string, string> = {
  "29": "Karnataka",
  "33": "Tamil Nadu",
  "36": "Telangana",
};

export function gstinCheckCharacter(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARSET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

export function isValidGstin(gstin: string): boolean {
  return GSTIN_SHAPE.test(gstin) && gstinCheckCharacter(gstin.slice(0, 14)) === gstin[14];
}

export function gstinState(gstin: string): string | undefined {
  return GST_STATE_CODES[gstin.slice(0, 2)];
}
