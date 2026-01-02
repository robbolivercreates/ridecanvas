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

    // Determine base URL - use FRONTEND_URL or fallback to production URL
    const baseUrl = process.env.FRONTEND_URL || 'https://overland-art-director.vercel.app';
    
    // Build URLs for Stripe
    // Note: {CHECKOUT_SESSION_ID} is a Stripe template variable that gets replaced with actual session ID
    const successUrl = `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/?cancelled=true`;

    console.log('Stripe config:', { baseUrl, successUrl, cancelUrl, artSessionId });

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
