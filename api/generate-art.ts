/**
 * Serverless API: Generate Art (Preview)
 * 
 * Generates a single phone wallpaper preview.
 * Prompts are built server-side - never exposed to client.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { 
  buildBasePrompt, 
  buildFirstGenerationPrompt,
  VehicleAnalysis 
} from './templates.js';

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
    const { 
      image, 
      analysis, 
      style, 
      background, 
      fidelity, 
      position, 
      stance, 
      selectedMods 
    } = req.body;

    if (!image || !analysis) {
      return res.status(400).json({ error: 'Image and analysis are required' });
    }

    // Initialize Gemini
    const ai = new GoogleGenAI({ apiKey });

    // Build SECRET prompts (never exposed to client)
    const basePrompt = buildBasePrompt({
      analysis: analysis as VehicleAnalysis,
      style: style || 'Poster Art',
      background: background || 'Mountain Peaks',
      fidelity: fidelity || 'Clean Build',
      position: position || 'As Photographed',
      stance: stance || 'Stock',
      selectedMods: selectedMods || [],
      popularWheelName: analysis.popularWheels?.[0]?.name
    });

    const fullPrompt = buildFirstGenerationPrompt(basePrompt, 'phone');

    // Generate image
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents: { 
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: image } },
          { text: fullPrompt }
        ] 
      },
      config: { responseModalities: ["image", "text"] },
    });

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return res.status(200).json({
          success: true,
          data: part.inlineData.data
        });
      }
    }

    throw new Error("No image generated");

  } catch (error: any) {
    console.error('Generation failed:', error);
    return res.status(500).json({ 
      error: error.message || 'Generation failed' 
    });
  }
}
