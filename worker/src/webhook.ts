/**
 * Stripe webhook signature check: `Stripe-Signature: t=<ts>,v1=<hex>,…` where
 * hex = HMAC-SHA256(secret, `${ts}.${rawBody}`), with a replay window.
 */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds: number): Promise<boolean> {
  if (!header) {
    return false;
  }
  const parts = new Map<string, string[]>();
  for (const item of header.split(',')) {
    const [k, v] = item.split('=', 2).map((s) => s.trim());
    if (k && v) {
      parts.set(k, [...(parts.get(k) ?? []), v]);
    }
  }
  const timestamp = Number(parts.get('t')?.[0]);
  const signatures = parts.get('v1') ?? [];
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    return false;
  }
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((candidate) => timingSafeEqual(candidate, expected));
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
