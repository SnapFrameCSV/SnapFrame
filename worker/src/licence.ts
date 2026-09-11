/**
 * Key minting, mirror of the extension's verify.ts: a key is
 * `SNAP-<base64url(payload JSON)>.<base64url(64-byte Ed25519 signature)>`
 * with payload `{ p: "pro", v: 1, iat: <unix seconds>, e: <12 hex of sha256(email)> }`.
 * WebCrypto only, so it runs identically in Workers and in Node tests.
 */
export interface LicencePayload {
  p: 'pro';
  v: number;
  iat: number;
  e: string;
}

export const KEY_PREFIX = 'SNAP-';
const ED25519 = { name: 'Ed25519' };

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function base64ToBytes(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text.trim()), (c) => c.charCodeAt(0));
}

export function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** First 12 hex chars of sha256(lower-cased, trimmed email). */
export async function emailHash(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
  return hex(new Uint8Array(digest)).slice(0, 12);
}

export async function importSigningKey(pkcs8Base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', base64ToBytes(pkcs8Base64), ED25519, true, ['sign']);
}

/** The raw 32-byte public half of a PKCS8 private key (what the extension embeds, as hex). */
export async function publicKeyOf(privateKey: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  if (!jwk.x) {
    throw new Error('private key JWK has no public component');
  }
  return fromBase64url(jwk.x);
}

export async function mintKey(email: string, privateKey: CryptoKey, nowSeconds: number): Promise<{ key: string; payload: LicencePayload }> {
  const payload: LicencePayload = { p: 'pro', v: 1, iat: nowSeconds, e: await emailHash(email) };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = new Uint8Array(await crypto.subtle.sign(ED25519, privateKey, bytes));
  return { key: `${KEY_PREFIX}${base64url(bytes)}.${base64url(signature)}`, payload };
}

/** Verification with the raw public key — used by /health to prove the configured signing key works end to end. */
export async function verifyKey(key: string, publicKeyRaw32: Uint8Array<ArrayBuffer>): Promise<LicencePayload | null> {
  if (!key.startsWith(KEY_PREFIX)) {
    return null;
  }
  const [payloadPart, signaturePart, extra] = key.slice(KEY_PREFIX.length).split('.');
  if (!payloadPart || !signaturePart || extra !== undefined) {
    return null;
  }
  const payloadBytes = fromBase64url(payloadPart);
  const signature = fromBase64url(signaturePart);
  if (signature.length !== 64) {
    return null;
  }
  const publicKey = await crypto.subtle.importKey('raw', publicKeyRaw32, ED25519, false, ['verify']);
  const ok = await crypto.subtle.verify(ED25519, publicKey, signature, payloadBytes);
  if (!ok) {
    return null;
  }
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as LicencePayload;
  return payload.p === 'pro' && typeof payload.iat === 'number' && typeof payload.e === 'string' ? payload : null;
}
