/**
 * Serverless API: Generate Remaining Formats
 * 
 * Generates Desktop (16:9) and Print (4:3) versions based on existing Phone preview.
 * Uses the phone art as a style reference for consistency.
 * Prompts are built server-side - never exposed to client.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { 
  buildBasePrompt, 
  buildFollowUpGenerationPrompt,
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
      image,           // Original vehicle photo
      previewArt,      // Existing phone art (style reference)
      analysis, 
      style, 
      background, 
      fidelity, 
      position, 
      stance, 
      selectedMods 
    } = req.body;

    if (!image || !previewArt || !analysis) {
      return res.status(400).json({ error: 'Image, previewArt and analysis are required' });
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

    // Helper to generate with reference image
    const generateWithReference = async (format: 'desktop' | 'print'): Promise<string> => {
      const fullPrompt = buildFollowUpGenerationPrompt(basePrompt, format);
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents: { 
          parts: [
            { inlineData: { mimeType: "image/png", data: previewArt } },
            { inlineData: { mimeType: "image/jpeg", data: image } },
            { text: fullPrompt }
          ] 
        },
        config: { responseModalities: ["image", "text"] },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return part.inlineData.data!;
        }
      }
      throw new Error(`Failed to generate ${format}`);
    };

    // Generate Desktop (16:9)
    const desktopArt = await generateWithReference('desktop');
    
    // Generate Print (4:3)
    const printArt = await generateWithReference('print');

    return res.status(200).json({
      success: true,
      data: {
        phone: previewArt,  // Reuse the preview
        desktop: desktopArt,
        print: printArt
      }
    });

  } catch (error: any) {
    console.error('Generation failed:', error);
    return res.status(500).json({ 
      error: error.message || 'Generation failed' 
    });
  }
}
