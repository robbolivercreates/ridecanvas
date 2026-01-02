/**
 * Stripe Payment Service
 * 
 * Integrates with Vercel API Routes for secure payment processing.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// @ts-ignore - Vite env
const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;
const API_BASE = isProd ? '' : ''; // API is always relative

// ============================================================================
// TYPES
// ============================================================================

export interface CheckoutResponse {
  url: string;
  sessionId: string;
}

export interface PaymentVerification {
  success: boolean;
  sessionId: string;
  paymentStatus: string;
  customerEmail?: string;
  metadata?: {
    artSessionId?: string;
    vehicleInfo?: string;
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Create a Stripe Checkout session and redirect to payment
 */
export const createCheckoutSession = async (
  artSessionId: string,
  vehicleInfo?: string
): Promise<CheckoutResponse> => {
  const response = await fetch(`${API_BASE}/api/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      artSessionId,
      vehicleInfo,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }

  return response.json();
};

/**
 * Redirect user to Stripe Checkout
 */
export const redirectToCheckout = async (
  artSessionId: string,
  vehicleInfo?: string
): Promise<void> => {
  const { url } = await createCheckoutSession(artSessionId, vehicleInfo);
  window.location.href = url;
};

/**
 * Verify payment was successful (call after returning from Stripe)
 */
export const verifyPayment = async (sessionId: string): Promise<PaymentVerification> => {
  const response = await fetch(`${API_BASE}/api/verify-payment?session_id=${sessionId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to verify payment');
  }

  return response.json();
};

/**
 * Check URL for payment success/cancel parameters
 */
export const checkPaymentStatus = (): { 
  sessionId: string | null; 
  cancelled: boolean;
  artSessionId: string | null;
} => {
  const params = new URLSearchParams(window.location.search);
  return {
    sessionId: params.get('session_id'),
    cancelled: params.get('cancelled') === 'true',
    artSessionId: params.get('art'),
  };
};

/**
 * Clear payment parameters from URL
 */
export const clearPaymentParams = (): void => {
  const url = new URL(window.location.href);
  url.searchParams.delete('session_id');
  url.searchParams.delete('cancelled');
  url.searchParams.delete('art');
  window.history.replaceState({}, '', url.pathname);
};
