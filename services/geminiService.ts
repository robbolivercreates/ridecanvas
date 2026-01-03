/**
 * Gemini Service - Client Side
 * 
 * This file only contains fetch calls to secure API endpoints.
 * All AI prompts and logic are hidden server-side in /api/*.ts
 * 
 * The user's browser NEVER sees the actual prompts.
 */

import { VehicleAnalysis, BackgroundTheme, FidelityMode, PositionMode, StanceStyle } from "../types";

// ============================================================================
// FILE UTILITIES
// ============================================================================

// Vercel Serverless has a 4.5MB request body limit
// We need to keep images well under this limit
const MAX_IMAGE_DIMENSION = 1400; // Reduced from 2048
const MAX_PAYLOAD_SIZE_BYTES = 3 * 1024 * 1024; // 3MB max to stay safe under 4.5MB limit

/**
 * Compress and resize image to fit within Vercel's payload limits
 * Uses iterative compression if needed
 */
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      let { width, height } = img;
      
      // Calculate new dimensions - always resize to max dimension
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Start with good quality and reduce if needed
      let quality = 0.75;
      let base64Data = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      
      // Iteratively reduce quality if still too large
      while (base64Data.length > MAX_PAYLOAD_SIZE_BYTES && quality > 0.3) {
        quality -= 0.1;
        base64Data = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        console.log(`Compressing: quality=${quality.toFixed(1)}, size=${(base64Data.length / 1024 / 1024).toFixed(2)}MB`);
      }
      
      // If still too large, reduce dimensions further
      if (base64Data.length > MAX_PAYLOAD_SIZE_BYTES) {
        const smallerRatio = 0.7;
        canvas.width = Math.round(width * smallerRatio);
        canvas.height = Math.round(height * smallerRatio);
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        console.log(`Final resize: ${canvas.width}x${canvas.height}, size=${(base64Data.length / 1024 / 1024).toFixed(2)}MB`);
      }
      
      resolve(base64Data);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    
    // Read the file as data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const fileToGenerativePart = async (file: File): Promise<string> => {
  // Always compress images to ensure they fit within Vercel limits
  if (file.type.startsWith('image/') || 
      file.type === 'image/heic' || 
      file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif')) {
    return compressImage(file);
  }
  
  // Fallback for non-image files (shouldn't happen)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// ============================================================================
// API CALLS - All prompts are hidden server-side
// ============================================================================

/**
 * Analyze a vehicle image
 * Prompt is SECRET - built on server
 */
export const analyzeVehicle = async (base64Image: string): Promise<VehicleAnalysis> => {
  const response = await fetch('/api/analyze-vehicle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image })
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    throw new Error(result.error || 'Analysis failed');
  }

  return result.data;
};

/**
 * Generate art preview (phone format)
 * Prompt is SECRET - built on server
 */
export const generateArt = async (
  base64Image: string,
  analysis: VehicleAnalysis,
  style: string,
  background: BackgroundTheme,
  fidelity: FidelityMode,
  position: PositionMode,
  stance: StanceStyle,
  selectedMods: string[]
): Promise<string> => {
  const response = await fetch('/api/generate-art', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64Image,
      analysis,
      style,
      background,
      fidelity,
      position,
      stance,
      selectedMods
    })
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    throw new Error(result.error || 'Generation failed');
  }

  // Store mimeType for later download
  if (result.mimeType) {
    (window as any).__lastArtMimeType = result.mimeType;
  }

  return result.data;
};

// ============================================================================
// GENERATED ART SET
// ============================================================================

export interface GeneratedArtSet {
  phone: string;   // 9:16 vertical
  desktop: string; // 16:9 horizontal
  print: string;   // 4:3 print
  mimeType?: string; // image/png or image/jpeg
}

/**
 * Generate remaining formats (desktop, print) based on existing preview
 * Uses preview as style reference for consistency
 * Prompt is SECRET - built on server
 */
export const generateRemainingFormats = async (
  base64Image: string,
  existingPhoneArt: string,
  analysis: VehicleAnalysis,
  style: string,
  background: BackgroundTheme,
  fidelity: FidelityMode,
  position: PositionMode,
  stance: StanceStyle,
  selectedMods: string[],
  onProgress?: (step: string) => void
): Promise<GeneratedArtSet> => {
  onProgress?.("Creating Desktop and Print versions...");
  
  const response = await fetch('/api/generate-remaining', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64Image,
      previewArt: existingPhoneArt,
      analysis,
      style,
      background,
      fidelity,
      position,
      stance,
      selectedMods
    })
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    throw new Error(result.error || 'Generation failed');
  }

  // Include mimeType in the returned data
  return {
    ...result.data,
    mimeType: result.mimeType || 'image/png'
  };
};

/**
 * Legacy function for generating all 3 formats at once
 * (Used as fallback when no preview exists)
 */
export const generateArtSet = async (
  base64Image: string,
  analysis: VehicleAnalysis,
  style: string,
  background: BackgroundTheme,
  fidelity: FidelityMode,
  position: PositionMode,
  stance: StanceStyle,
  selectedMods: string[],
  onProgress?: (step: string) => void
): Promise<GeneratedArtSet> => {
  // Step 1: Generate phone preview
  onProgress?.("Creating Phone wallpaper (1/3)...");
  const phoneArt = await generateArt(
    base64Image, analysis, style, background, fidelity, position, stance, selectedMods
  );
  
  // Step 2: Generate remaining formats using phone as reference
  onProgress?.("Creating Desktop and Print (2/3, 3/3)...");
  const fullSet = await generateRemainingFormats(
    base64Image, phoneArt, analysis, style, background, fidelity, position, stance, selectedMods
  );
  
  return fullSet;
};
