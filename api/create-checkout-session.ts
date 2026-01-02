import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { artSessionId, vehicleInfo } = req.body;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!, // price_1SlGsOIuMjOpjyE7PI4oF9Am
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}&art=${artSessionId}`,
      cancel_url: `${process.env.FRONTEND_URL || req.headers.origin}/?cancelled=true`,
      metadata: {
        artSessionId: artSessionId || '',
        vehicleInfo: vehicleInfo || '',
      },
      // Optional: collect customer email
      // customer_email: email,
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
