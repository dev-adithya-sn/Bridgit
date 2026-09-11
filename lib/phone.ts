/**
 * Normalises a phone number to E.164 (+<country><number>), as WhatsApp
 * requires. A bare 10-digit number is assumed to be Indian (+91).
 * Returns null when the input can't be a valid number.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  if (/^\+\d{8,15}$/.test(compact)) return compact;
  if (/^\d{10}$/.test(compact)) return `+91${compact}`;
  if (/^0\d{10}$/.test(compact)) return `+91${compact.slice(1)}`;
  return null;
}
