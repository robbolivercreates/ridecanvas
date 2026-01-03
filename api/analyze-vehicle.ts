/**
 * Serverless API: Analyze Vehicle
 * 
 * Analyzes an uploaded vehicle image to extract details.
 * Prompts are built server-side - never exposed to client.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { ANALYZE_VEHICLE_PROMPT, ANALYZE_VEHICLE_SCHEMA, VehicleCategory } from './templates.js';

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

  // Check API key configuration
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured!');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  try {
    const { image } = req.body;

    if (!image) {
      console.error('No image provided in request body');
      return res.status(400).json({ error: 'Image is required' });
    }

    console.log('Received image, length:', image?.length || 0);

    // Initialize Gemini
    const ai = new GoogleGenAI({ apiKey });

    console.log('Calling Gemini API...');

    // Call Gemini with SECRET prompt (never exposed to client)
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: { 
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: image } }, 
          { text: ANALYZE_VEHICLE_PROMPT }
        ] 
      },
      config: { 
        responseMimeType: "application/json", 
        responseSchema: ANALYZE_VEHICLE_SCHEMA,
        tools: [{ googleSearch: {} }]
      }
    });

    console.log('Gemini response received');

    const result = JSON.parse(response.text!);
    result.category = result.category as VehicleCategory;

    console.log('Analysis success:', result.make, result.model);

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Analysis failed:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    return res.status(500).json({ 
      error: error.message || 'Analysis failed' 
    });
  }
}
