import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

/**
 * Offline verification of Pro licence keys (design §2 step 5, D06). A key is
 * `SNAP-<base64url(payload JSON)>.<base64url(64-byte Ed25519 signature)>`,
 * signed by the Worker's private key and checked here against the public
 * half in publicKey.ts. Pure: no vscode, no network, no clock other than
 * `Date.now` for the future-issue check.
 */

export interface LicencePayload {
  p: 'pro';
  v: number;
  /** Unix seconds when the key was issued. */
  iat: number;
  /** First 12 hex chars of sha256(lowercased purchase email). */
  e: string;
}

export type VerifyFailure = 'malformed' | 'no-public-key' | 'bad-signature' | 'issued-in-future';

export interface VerifyResult {
  ok: boolean;
  payload?: LicencePayload;
  reason?: VerifyFailure;
}

export const KEY_PREFIX = 'SNAP-';
/** How far in the future an `iat` may sit before the key is refused (clock skew allowance). */
export const FUTURE_TOLERANCE_SECONDS = 24 * 60 * 60;

// DER prefix of an Ed25519 SubjectPublicKeyInfo; the raw 32-byte key follows it.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function verifyKey(key: string, publicKeyRaw32: Uint8Array, nowSeconds: number = Math.floor(Date.now() / 1000)): VerifyResult {
  if (typeof key !== 'string') {
    return fail('malformed');
  }
  const trimmed = key.trim();
  if (!trimmed.startsWith(KEY_PREFIX)) {
    return fail('malformed');
  }
  const body = trimmed.slice(KEY_PREFIX.length);
  const dot = body.indexOf('.');
  if (dot <= 0 || dot === body.length - 1 || body.indexOf('.', dot + 1) !== -1) {
    return fail('malformed');
  }
  const payloadPart = body.slice(0, dot);
  const signaturePart = body.slice(dot + 1);
  if (!BASE64URL.test(payloadPart) || !BASE64URL.test(signaturePart)) {
    return fail('malformed');
  }
  const payloadBytes = Buffer.from(payloadPart, 'base64url');
  const signature = Buffer.from(signaturePart, 'base64url');
  if (signature.length !== 64 || payloadBytes.length === 0) {
    return fail('malformed');
  }

  if (!(publicKeyRaw32 instanceof Uint8Array) || publicKeyRaw32.length !== 32) {
    return fail('no-public-key');
  }
  let signatureOk: boolean;
  try {
    const publicKey = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyRaw32)]),
      format: 'der',
      type: 'spki',
    });
    signatureOk = cryptoVerify(null, payloadBytes, publicKey, signature);
  } catch {
    return fail('no-public-key');
  }
  if (!signatureOk) {
    return fail('bad-signature');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString('utf8'));
  } catch {
    return fail('malformed');
  }
  if (!isLicencePayload(parsed)) {
    return fail('malformed');
  }
  if (parsed.iat > nowSeconds + FUTURE_TOLERANCE_SECONDS) {
    return fail('issued-in-future');
  }
  return { ok: true, payload: parsed };
}

function isLicencePayload(value: unknown): value is LicencePayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.p === 'pro' &&
    typeof candidate.v === 'number' &&
    Number.isInteger(candidate.v) &&
    typeof candidate.iat === 'number' &&
    Number.isFinite(candidate.iat) &&
    typeof candidate.e === 'string' &&
    /^[0-9a-f]{12}$/.test(candidate.e)
  );
}

function fail(reason: VerifyFailure): VerifyResult {
  return { ok: false, reason };
}

/** Plain-English reason for the user; never mentions servers because there are none. */
export function describeFailure(reason: VerifyFailure | undefined): string {
  switch (reason) {
    case 'malformed':
      return "that doesn't look like a Snapframe key — it should start with SNAP- and be pasted whole";
    case 'bad-signature':
      return 'the key does not match this version of Snapframe';
    case 'issued-in-future':
      return 'the key is dated in the future — check your computer clock';
    case 'no-public-key':
      return 'this build cannot verify keys yet';
    default:
      return 'unknown reason';
  }
}

// The active licence for this session. Set by licence/activate.ts after the
// stored key verifies; read by every Pro-gated feature (Slice 4). Kept here,
// vscode-free, so pure tests can exercise the gate.
let activeLicence: LicencePayload | null = null;

export function isPro(): boolean {
  return activeLicence !== null;
}

export function activeLicencePayload(): LicencePayload | null {
  return activeLicence;
}

export function setActiveLicence(payload: LicencePayload | null): void {
  activeLicence = payload;
}
