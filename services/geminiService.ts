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

export const fileToGenerativePart = async (file: File): Promise<string> => {
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
