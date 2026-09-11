/**
 * The three read-only Stripe calls the Worker makes, with the restricted key
 * (Checkout Sessions, Charges, Payment Intents — read). Thin, so tests stub
 * `fetch` and check the exact paths.
 */
const STRIPE_API = 'https://api.stripe.com/v1';

export interface CheckoutSession {
  id: string;
  payment_status: string;
  status?: string;
  created?: number;
  payment_intent?: string | null;
  customer_details?: { email?: string | null } | null;
}

export interface StripeClient {
  getCheckoutSession(id: string): Promise<CheckoutSession | null>;
  latestPaidSessionForEmail(email: string): Promise<CheckoutSession | null>;
  last4ForPaymentIntent(id: string): Promise<string | null>;
}

export function stripeClient(restrictedKey: string, fetchImpl: typeof fetch): StripeClient {
  async function get(path: string): Promise<unknown | null> {
    const response = await fetchImpl(`${STRIPE_API}${path}`, {
      headers: { Authorization: `Bearer ${restrictedKey}`, 'Stripe-Version': '2024-06-20' },
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Stripe ${path} returned ${response.status}`);
    }
    return response.json();
  }

  return {
    async getCheckoutSession(id) {
      if (!/^cs_[A-Za-z0-9_]+$/.test(id)) {
        return null;
      }
      return (await get(`/checkout/sessions/${encodeURIComponent(id)}`)) as CheckoutSession | null;
    },
    async latestPaidSessionForEmail(email) {
      const result = (await get(`/checkout/sessions?customer_details[email]=${encodeURIComponent(email)}&limit=10`)) as { data?: CheckoutSession[] } | null;
      const paid = (result?.data ?? []).filter((s) => s.payment_status === 'paid').sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
      return paid[0] ?? null;
    },
    async last4ForPaymentIntent(id) {
      if (!/^pi_[A-Za-z0-9_]+$/.test(id)) {
        return null;
      }
      const intent = (await get(`/payment_intents/${encodeURIComponent(id)}?expand[]=latest_charge`)) as {
        latest_charge?: { payment_method_details?: { card?: { last4?: string } } } | null;
      } | null;
      return intent?.latest_charge?.payment_method_details?.card?.last4 ?? null;
    },
  };
}
