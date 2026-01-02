import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Check if Stripe key is configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRICE_ID;

if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY is not configured!');
}

// Initialize Stripe with secret key
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check configuration
  if (!stripe || !stripePriceId) {
    console.error('Missing config:', { hasStripe: !!stripe, hasPriceId: !!stripePriceId });
    return res.status(500).json({ 
      error: 'Payment service not configured',
      debug: { hasStripeKey: !!stripeSecretKey, hasPriceId: !!stripePriceId }
    });
  }

  try {
    const { artSessionId, vehicleInfo } = req.body;

    // Determine base URL - MUST be a valid URL
    const frontendUrl = process.env.FRONTEND_URL;
    const origin = req.headers.origin as string | undefined;
    const host = req.headers.host;
    
    const baseUrl = frontendUrl 
      || origin 
      || (host ? `https://${host}` : 'https://overland-art-director.vercel.app');
    
    console.log('URLs debug:', { frontendUrl, origin, host, baseUrl });

    // Build URLs - IMPORTANT: {CHECKOUT_SESSION_ID} must NOT be URL encoded
    // Stripe replaces this placeholder with the actual session ID on redirect
    const successUrl = `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}${artSessionId ? `&art=${encodeURIComponent(artSessionId)}` : ''}`;
    const cancelUrl = `${baseUrl}/?cancelled=true`;

    console.log('Stripe URLs:', { success: successUrl, cancel: cancelUrl });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        artSessionId: artSessionId || '',
        vehicleInfo: vehicleInfo || '',
      },
    });

    return res.status(200).json({ 
      url: session.url,
      sessionId: session.id 
    });
  } catch (error: any) {
    console.error('Stripe error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create checkout session' 
    });
  }
}
