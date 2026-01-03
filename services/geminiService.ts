import { GoogleGenAI, Type } from "@google/genai";
import { 
  VehicleAnalysis, ArtStyle, BackgroundTheme, StanceStyle, 
  FidelityMode, VehicleCategory, PositionMode 
} from "../types";

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

export const analyzeVehicle = async (
  base64Image: string,
  apiKey: string
): Promise<VehicleAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });
  const prompt = `
    Act as an Expert Automotive Analyst and Car Culture Specialist. Analyze this vehicle with EXTREME attention to detail.
    
    1. **Identity:** Make, Model, Year, Color.
    
    2. **Category Classification:** Determine which category best fits:
       - "Off-Road" (SUVs with mods, lifted trucks, 4x4s, overlanders, Land Rovers, Jeeps, Toyota 4Runners, etc.)
       - "Sports" (coupes, hot hatches, muscle cars, performance vehicles)
       - "Luxury" (premium sedans, executive SUVs like Range Rover Sport, BMW X5, etc.)
       - "Classic" (vintage/retro vehicles, pre-1990)
       - "Everyday" (hatchbacks, sedans, minivans, economy cars)
    
    3. **Is Off-Road:** Boolean - does this vehicle have off-road modifications OR is it an overland-capable 4x4 vehicle by nature?
    
    4. **Orientation:** Exactly which side is shown (Driver Side/Passenger Side) and which way is it facing (Left/Right).
    
    5. **Geometry Audit:** Silhouette, Window Layout, Lights, Bumpers.
    
    6. **INSTALLED ACCESSORIES (CRITICAL):** List EVERY visible accessory and modification installed on this specific vehicle. Be extremely thorough:
       - Roof: roof rack, roof box, rooftop tent, awning, light bars, antennas
       - Exterior: mudguards/mud flaps, fender flares, side steps, running boards, rock sliders
       - Front: bull bar, nudge bar, winch, auxiliary lights, skid plate
       - Rear: spare tire carrier, bike rack, ladder, rear bumper, tow hitch
       - Windows: window guards, rain deflectors, tinting
       - Other: snorkel, jerry cans, recovery boards, decals, stickers, badges
       ONLY list what you can ACTUALLY SEE. Do not assume or guess.
    
    7. **Character Marks:** Unique identifiers: stickers, decals, brand logos, mud splashes, dirt patterns, scratches.
    
    8. **Popular Modifications:** Use Google Search to find what enthusiasts commonly do to customize this specific make/model. List 4-5 popular mods.
    
    9. **Popular Wheels:** Use Google Search to find the most popular aftermarket wheel brands/styles that enthusiasts put on this specific make/model. List 2-3 popular wheel options with brand and style.
    
    10. **Suggested Stance:** Based on the vehicle category:
        - For Off-Road vehicles: suggest "Stock", "Lifted + AT", or "Steelies + Mud"
        - For other vehicles: suggest "Stock" or "Lowered + Wheels"
    
    11. **Suggested Background:** Based on the vehicle type, suggest the best background theme.
    
    Return JSON.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      make: { type: Type.STRING },
      model: { type: Type.STRING },
      year: { type: Type.STRING },
      color: { type: Type.STRING },
      category: { 
        type: Type.STRING, 
        enum: ["Off-Road", "Sports", "Luxury", "Classic", "Everyday"],
        description: "The vehicle category classification"
      },
      isOffroad: { 
        type: Type.BOOLEAN, 
        description: "True if vehicle has off-road mods or is an overland-capable 4x4 vehicle" 
      },
      orientation: { type: Type.STRING },
      facingDirection: { type: Type.STRING },
      mods: { type: Type.ARRAY, items: { type: Type.STRING } },
      installedAccessories: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Complete list of all visible accessories and modifications installed on this specific vehicle"
      },
      geometryAudit: {
        type: Type.OBJECT,
        properties: {
          bodyShape: { type: Type.STRING },
          windowLayout: { type: Type.STRING },
          frontDetail: { type: Type.STRING },
        }
      },
      visualFeatures: {
        type: Type.OBJECT,
        properties: {
          roofGear: { type: Type.STRING },
          wheelStyle: { type: Type.STRING },
          distinctiveMarkings: { type: Type.STRING },
        }
      },
      popularMods: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
          }
        },
      },
      popularWheels: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            style: { type: Type.STRING },
          }
        },
      },
      suggestedStance: {
        type: Type.STRING,
        enum: ["Stock", "Lifted + AT", "Steelies + Mud", "Lowered + Wheels"],
      },
      suggestedBackground: {
        type: Type.STRING,
        enum: ["Studio Clean", "Mountain Peaks", "Nordic Forest", "Desert Dunes", "City Skyline", "Neon Night", "Studio Garage"],
      },
    },
    required: ["make", "model", "year", "color", "category", "isOffroad", "orientation", "facingDirection"],
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [{ inlineData: { mimeType: "image/jpeg", data: base64Image } }, { text: prompt }] },
    config: { 
      responseMimeType: "application/json", 
      responseSchema: responseSchema,
      tools: [{ googleSearch: {} }]
    }
  });

  const result = JSON.parse(response.text!) as VehicleAnalysis;
  result.category = result.category as VehicleCategory;
  return result;
};

// ============================================================================
// GENERATE ART - Creates 3 images (Phone, Desktop, Print) with consistent style
// ============================================================================

export interface GeneratedArtSet {
  phone: string;   // 9:16 vertical
  desktop: string; // 16:9 horizontal
  print: string;   // 4:3 print
}

// Build the base prompt (shared across all formats)
const buildBasePrompt = (
  analysis: VehicleAnalysis,
  style: ArtStyle,
  background: BackgroundTheme,
  fidelity: FidelityMode,
  position: PositionMode,
  stance: StanceStyle,
  selectedMods: string[]
): string => {
  // Position instructions
  const positionInstructions = position === PositionMode.AS_PHOTOGRAPHED
    ? `Keep the EXACT same angle and perspective as the source photo. Preserve orientation: ${analysis.orientation}, facing ${analysis.facingDirection}.`
    : `Convert to a CLEAN SIDE PROFILE view (90-degree lateral). Facing ${analysis.facingDirection}.`;

  const backgroundPrompts: Record<BackgroundTheme, string> = {
    [BackgroundTheme.SOLID]: "Clean studio solid matte background in neutral dark tone. Subtle reflective floor.",
    [BackgroundTheme.GRADIENT]: "Soft gradient background, dark to lighter tones. Studio floor.",
    [BackgroundTheme.MOUNTAINS]: "Geometric mountain silhouettes with large minimalist Sun circle. Rocky gravel ground.",
    [BackgroundTheme.FOREST]: "Nordic pine silhouettes in layered forest greens. Dark earth clearing foreground.",
    [BackgroundTheme.DESERT]: "Vector canyon mesas and sand dunes in terracotta tones. Sandy ground.",
    [BackgroundTheme.TOPO]: "Technical topographic contour lines on matte background. Minimal ground line.",
    [BackgroundTheme.CITY]: "Minimalist city skyline silhouette in cool blue-gray. Asphalt street.",
    [BackgroundTheme.NEON]: "Dark urban nightscape with neon glows. Wet asphalt with reflections.",
    [BackgroundTheme.GARAGE]: "Clean automotive studio with professional lighting. Polished concrete floor.",
  };

  // Stance
  let stancePrompt = "";
  switch (stance) {
    case StanceStyle.STOCK:
      stancePrompt = "Keep EXACT wheel design, tire size, and suspension height from source.";
      break;
    case StanceStyle.LIFTED:
      stancePrompt = "Add 2-3 inch lift with aggressive AT tires. Increase tire sidewall.";
      break;
    case StanceStyle.STEELIES:
      stancePrompt = "Black steel wheels (steelies) with 33-inch mud-terrain tires. 2-inch lift.";
      break;
    case StanceStyle.LOWERED:
      const wheelInfo = analysis.popularWheels?.[0]?.name || "aftermarket wheels";
      stancePrompt = `Lower 1-2 inches, sportier stance. Add ${wheelInfo} with low profile tires.`;
      break;
  }

  // Fidelity
  const fidelityPrompts: Record<FidelityMode, string> = {
    [FidelityMode.EXACT_MATCH]: "EXACT MATCH: Include ALL stickers, decals, mud, dirt, scratches.",
    [FidelityMode.CLEAN_BUILD]: "CLEAN BUILD: Keep all mods/stickers but remove dirt and imperfections.",
    [FidelityMode.FACTORY_FRESH]: "FACTORY FRESH: Remove all aftermarket mods. Pure stock OEM look.",
  };

  // Accessories
  const accessories = analysis.installedAccessories?.length
    ? `INSTALLED ACCESSORIES (include these): ${analysis.installedAccessories.join(", ")}`
    : "";

  // Virtual mods
  const mods = selectedMods.length
    ? `ADD VIRTUAL MODS: ${selectedMods.join(", ")}`
    : "";

  return `
**VEHICLE:** ${analysis.year} ${analysis.make} ${analysis.model} (${analysis.color})
**POSITION:** ${positionInstructions}
**CONDITION:** ${fidelityPrompts[fidelity]}
**STANCE:** ${stancePrompt}
**SCENE:** ${backgroundPrompts[background]}
${accessories}
${mods}

**STYLE:** High-Fidelity Technical Vector Art. Clean lines, matte cel-shading.
${style === ArtStyle.POSTER ? 'Editorial Poster Art aesthetic.' : 'Vector Badge/Sticker aesthetic.'}
Sharp vector paths, no photo textures. Premium wallpaper quality.
  `.trim();
};

// Generate a single image for a specific format
const generateSingleFormat = async (
  ai: GoogleGenAI,
  sourceImage: string,
  referenceArt: string | null,
  basePrompt: string,
  format: 'phone' | 'desktop' | 'print'
): Promise<string> => {
  
  const formatConfigs = {
    phone: {
      aspectRatio: "9:16",
      orientation: "VERTICAL/PORTRAIT (9:16, taller than wide)",
      composition: `
        PHONE WALLPAPER COMPOSITION:
        - Vehicle positioned in LOWER THIRD (60-70% down from top)
        - Leave LOTS of sky/space above for phone clock and notch
        - Car size: 35-40% of image width
        - Perfect for mobile lock screen
      `,
      resolution: "2160x3840 (4K vertical - Ultra HD quality)"
    },
    desktop: {
      aspectRatio: "16:9",
      orientation: "HORIZONTAL/LANDSCAPE (16:9, wider than tall)",
      composition: `
        DESKTOP WALLPAPER COMPOSITION:
        - Vehicle centered, slightly lower (55% from top)
        - Wide panoramic feel
        - Car size: 40-45% of image width
        - Space on sides for desktop icons
      `,
      resolution: "3840x2160 (4K UHD - Ultra HD quality)"
    },
    print: {
      aspectRatio: "4:3",
      orientation: "HORIZONTAL/LANDSCAPE (4:3, classic photo ratio)",
      composition: `
        PRINT COMPOSITION:
        - Vehicle centered (50% from top)
        - Balanced margins for framing
        - Car size: 50% of image width
        - High detail for large format printing
      `,
      resolution: "4096x3072 (4K print quality - suitable for large format printing)"
    }
  };

  const config = formatConfigs[format];
  
  let prompt = "";
  
  if (referenceArt) {
    // This is a follow-up generation - match the style of the reference
    prompt = `
**CRITICAL: MATCH THE STYLE OF THE REFERENCE ART EXACTLY**

I'm providing TWO images:
1. The REFERENCE ART (first image) - This is the style you MUST match
2. The ORIGINAL PHOTO (second image) - The source vehicle

Your task: Create the SAME artwork but in ${config.aspectRatio} aspect ratio.

═══════════════════════════════════════════════════════════
⚠️ VEHICLE PROPORTIONS - DO NOT DISTORT ⚠️
═══════════════════════════════════════════════════════════

The vehicle in your output MUST have the EXACT SAME PROPORTIONS as in the reference art.

DO NOT:
✗ Stretch the vehicle horizontally to fill wider formats
✗ Compress the vehicle vertically 
✗ Change the width-to-height ratio of the car
✗ Make the car look "squashed" or "elongated"

DO:
✓ Keep the vehicle's proportions IDENTICAL to the reference
✓ Add MORE BACKGROUND to fill the new aspect ratio
✓ Extend the sky, ground, or scenery - NOT the car
✓ The car should look like it was copy-pasted from the reference

═══════════════════════════════════════════════════════════

STYLE MATCHING REQUIREMENTS:
- EXACT same color palette as reference
- EXACT same artistic style and line work
- EXACT same background elements (extend them, don't change them)
- EXACT same level of detail and shading
- The vehicle should be PIXEL-PERFECT identical in proportions

**FORMAT:** ${config.orientation}
**RESOLUTION:** ${config.resolution}

${config.composition}

${basePrompt}

**OUTPUT:** Generate a ${config.aspectRatio} image with the vehicle having IDENTICAL proportions to the reference. Extend the BACKGROUND to fill the new aspect ratio, NOT the car.
    `.trim();
    
    return generateWithTwoImages(ai, referenceArt, sourceImage, prompt);
  } else {
    // This is the first generation - establish the style
    prompt = `
**FORMAT:** ${config.orientation}
**RESOLUTION:** ${config.resolution}

${config.composition}

${basePrompt}

**IMPORTANT:** This artwork will be used as the STYLE REFERENCE for other aspect ratios.
Create a distinctive, cohesive visual style that can be replicated.

**OUTPUT:** Generate a high-quality ${config.aspectRatio} vector art wallpaper.
    `.trim();
    
    return generateWithOneImage(ai, sourceImage, prompt);
  }
};

// Generate with just the source image
const generateWithOneImage = async (
  ai: GoogleGenAI,
  sourceImage: string,
  prompt: string
): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { 
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: sourceImage } },
        { text: prompt }
      ] 
    },
    config: { responseModalities: ["image", "text"] },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return part.inlineData.data!;
  }
  throw new Error("Generation failed.");
};

// Generate with reference art + source image
const generateWithTwoImages = async (
  ai: GoogleGenAI,
  referenceArt: string,
  sourceImage: string,
  prompt: string
): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { 
      parts: [
        { inlineData: { mimeType: "image/png", data: referenceArt } },
        { inlineData: { mimeType: "image/jpeg", data: sourceImage } },
        { text: prompt }
      ] 
    },
    config: { responseModalities: ["image", "text"] },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return part.inlineData.data!;
  }
  throw new Error("Generation failed.");
};

// Main function - generates all 3 formats
export const generateArtSet = async (
  base64Image: string,
  analysis: VehicleAnalysis,
  style: ArtStyle,
  background: BackgroundTheme,
  fidelity: FidelityMode,
  position: PositionMode,
  stance: StanceStyle,
  selectedMods: string[],
  apiKey: string,
  onProgress?: (step: string) => void
): Promise<GeneratedArtSet> => {
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });
  
  const basePrompt = buildBasePrompt(
    analysis, style, background, fidelity, position, stance, selectedMods
  );

  // Step 1: Generate Phone (9:16) - This establishes the style
  onProgress?.("Creating Phone wallpaper (1/3)...");
  const phoneArt = await generateSingleFormat(ai, base64Image, null, basePrompt, 'phone');

  // Step 2: Generate Desktop (16:9) - Match the phone style
  onProgress?.("Creating Desktop wallpaper (2/3)...");
  const desktopArt = await generateSingleFormat(ai, base64Image, phoneArt, basePrompt, 'desktop');

  // Step 3: Generate Print (4:3) - Match the phone style
  onProgress?.("Creating Print version (3/3)...");
  const printArt = await generateSingleFormat(ai, base64Image, phoneArt, basePrompt, 'print');

  return {
    phone: phoneArt,
    desktop: desktopArt,
    print: printArt,
  };
};

// Generate remaining formats from existing preview (saves 1 API call, maintains consistency)
export const generateRemainingFormats = async (
  base64Image: string,
  existingPhoneArt: string,
  analysis: VehicleAnalysis,
  style: ArtStyle,
  background: BackgroundTheme,
  fidelity: FidelityMode,
  position: PositionMode,
  stance: StanceStyle,
  selectedMods: string[],
  apiKey: string,
  onProgress?: (step: string) => void
): Promise<GeneratedArtSet> => {
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });
  
  const basePrompt = buildBasePrompt(
    analysis, style, background, fidelity, position, stance, selectedMods
  );

  // Use existing phone art as the reference
  onProgress?.("Creating Desktop wallpaper (1/2)...");
  const desktopArt = await generateSingleFormat(ai, base64Image, existingPhoneArt, basePrompt, 'desktop');

  onProgress?.("Creating Print version (2/2)...");
  const printArt = await generateSingleFormat(ai, base64Image, existingPhoneArt, basePrompt, 'print');

  return {
    phone: existingPhoneArt,
    desktop: desktopArt,
    print: printArt,
  };
};

// Legacy single-format generator (for preview/compatibility)
export const generateArt = async (
  base64Image: string,
  analysis: VehicleAnalysis,
  style: ArtStyle,
  background: BackgroundTheme,
  fidelity: FidelityMode,
  position: PositionMode,
  stance: StanceStyle,
  selectedMods: string[],
  apiKey: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });
  
  const basePrompt = buildBasePrompt(
    analysis, style, background, fidelity, position, stance, selectedMods
  );

  // Generate just the phone version for preview
  return generateSingleFormat(ai, base64Image, null, basePrompt, 'phone');
};
