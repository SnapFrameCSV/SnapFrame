/**
 * The Ed25519 public key that Pro licence keys are verified against, as 64
 * hex characters (32 bytes). Public by design — it is pasted here by the
 * operator at gate-05 from the key pair generated in their browser; the
 * private half never leaves the Cloudflare Worker's secrets. Until then the
 * placeholder keeps `licencePublicKey()` returning null, so no key can
 * activate and `isPro()` stays false.
 */
export const LICENCE_PUBLIC_KEY_HEX = 'REPLACE_AT_GATE_05';

export function licencePublicKey(): Uint8Array | null {
  if (!/^[0-9a-fA-F]{64}$/.test(LICENCE_PUBLIC_KEY_HEX)) {
    return null;
  }
  return Uint8Array.from(Buffer.from(LICENCE_PUBLIC_KEY_HEX, 'hex'));
}
