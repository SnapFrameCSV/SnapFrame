export interface LicencePayload {
  p: 'pro';
  v: number;
  iat: number;
  e: string;
}

export interface VerifyResult {
  ok: boolean;
  payload?: LicencePayload;
  reason?: string;
}

// Real Ed25519 verification lands in Slice 3. Until then every key is rejected,
// so isPro() is false and no free-tier path can depend on this module.
export function verifyKey(_key: string, _publicKeyRaw32: Uint8Array): VerifyResult {
  return { ok: false, reason: 'not-implemented' };
}

export function isPro(): boolean {
  return false;
}
