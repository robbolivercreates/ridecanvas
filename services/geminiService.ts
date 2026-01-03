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

// Maximum image dimensions to avoid API limits (Gemini has ~20MB limit)
const MAX_IMAGE_DIMENSION = 2048;
const MAX_IMAGE_SIZE_MB = 4;

/**
 * Compress and resize image if needed
 * This prevents "image not clear" errors from oversized images
 */
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      let { width, height } = img;
      
      // Calculate new dimensions if image is too large
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Use JPEG with quality adjustment based on file size
      let quality = 0.85;
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        quality = 0.7; // More compression for very large files
      }
      
      const base64String = canvas.toDataURL('image/jpeg', quality);
      const base64Data = base64String.split(',')[1];
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
  // Check if compression is needed
  const needsCompression = 
    file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024 || // Larger than 4MB
    file.type === 'image/heic' || 
    file.type === 'image/heif';
  
  if (needsCompression || file.type.startsWith('image/')) {
    // Always use canvas for consistent handling
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

  return result.data;
};

// ============================================================================
// GENERATED ART SET
// ============================================================================

export interface GeneratedArtSet {
  phone: string;   // 9:16 vertical
  desktop: string; // 16:9 horizontal
  print: string;   // 4:3 print
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

  return result.data;
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
