/**
 * SERVER-SIDE PROMPT TEMPLATES
 * 
 * All prompts are stored here to prevent client-side exposure.
 * This file is NEVER sent to the browser - only runs on Vercel serverless.
 * 
 * ⚠️ DO NOT import this file in client-side code!
 */

// ============================================================================
// DUPLICATED ENUMS (isolated from client types.ts)
// ============================================================================

export enum ArtStyle {
  POSTER = 'Poster Art',
  STICKER = 'Sticker Badge',
}

export enum BackgroundTheme {
  SOLID = 'Studio Clean',
  GRADIENT = 'Soft Gradient',
  MOUNTAINS = 'Mountain Peaks',
  FOREST = 'Nordic Forest',
  DESERT = 'Desert Dunes',
  TOPO = 'Topographic',
  CITY = 'City Skyline',
  NEON = 'Neon Night',
  GARAGE = 'Studio Garage',
}

export enum VehicleCategory {
  OFFROAD = 'Off-Road',
  SPORTS = 'Sports',
  LUXURY = 'Luxury',
  CLASSIC = 'Classic',
  EVERYDAY = 'Everyday',
}

export enum FidelityMode {
  EXACT_MATCH = 'Exact Match',
  CLEAN_BUILD = 'Clean Build',
  FACTORY_FRESH = 'Factory Fresh',
}

export enum PositionMode {
  AS_PHOTOGRAPHED = 'As Photographed',
  SIDE_PROFILE = 'Side Profile',
}

export enum StanceStyle {
  STOCK = 'Stock',
  LIFTED = 'Lifted + AT',
  STEELIES = 'Steelies + Mud',
  LOWERED = 'Lowered + Wheels',
}

// ============================================================================
// TYPES
// ============================================================================

export interface PopularMod {
  id: string;
  name: string;
  description: string;
}

export interface PopularWheel {
  name: string;
  style: string;
}

export interface VehicleAnalysis {
  make: string;
  model: string;
  year: string;
  color: string;
  category: VehicleCategory;
  isOffroad: boolean;
  orientation: string;
  facingDirection: string;
  mods: string[];
  installedAccessories: string[];
  geometryAudit: {
    bodyShape: string;
    windowLayout: string;
    frontDetail: string;
  };
  visualFeatures: {
    roofGear: string;
    wheelStyle: string;
    distinctiveMarkings: string;
  };
  popularMods: PopularMod[];
  popularWheels: PopularWheel[];
  suggestedStance: StanceStyle;
  suggestedBackground: BackgroundTheme;
}

// ============================================================================
// ANALYZE VEHICLE PROMPT - SECRET
// ============================================================================

export const ANALYZE_VEHICLE_PROMPT = `
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

export const ANALYZE_VEHICLE_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    make: { type: "STRING" as const },
    model: { type: "STRING" as const },
    year: { type: "STRING" as const },
    color: { type: "STRING" as const },
    category: { 
      type: "STRING" as const, 
      enum: ["Off-Road", "Sports", "Luxury", "Classic", "Everyday"],
      description: "The vehicle category classification"
    },
    isOffroad: { 
      type: "BOOLEAN" as const, 
      description: "True if vehicle has off-road mods or is an overland-capable 4x4 vehicle" 
    },
    orientation: { type: "STRING" as const },
    facingDirection: { type: "STRING" as const },
    mods: { type: "ARRAY" as const, items: { type: "STRING" as const } },
    installedAccessories: { 
      type: "ARRAY" as const, 
      items: { type: "STRING" as const },
      description: "Complete list of all visible accessories and modifications installed on this specific vehicle"
    },
    geometryAudit: {
      type: "OBJECT" as const,
      properties: {
        bodyShape: { type: "STRING" as const },
        windowLayout: { type: "STRING" as const },
        frontDetail: { type: "STRING" as const },
      }
    },
    visualFeatures: {
      type: "OBJECT" as const,
      properties: {
        roofGear: { type: "STRING" as const },
        wheelStyle: { type: "STRING" as const },
        distinctiveMarkings: { type: "STRING" as const },
      }
    },
    popularMods: {
      type: "ARRAY" as const,
      items: {
        type: "OBJECT" as const,
        properties: {
          id: { type: "STRING" as const },
          name: { type: "STRING" as const },
          description: { type: "STRING" as const },
        }
      },
    },
    popularWheels: {
      type: "ARRAY" as const,
      items: {
        type: "OBJECT" as const,
        properties: {
          name: { type: "STRING" as const },
          style: { type: "STRING" as const },
        }
      },
    },
    suggestedStance: {
      type: "STRING" as const,
      enum: ["Stock", "Lifted + AT", "Steelies + Mud", "Lowered + Wheels"],
    },
    suggestedBackground: {
      type: "STRING" as const,
      enum: ["Studio Clean", "Mountain Peaks", "Nordic Forest", "Desert Dunes", "City Skyline", "Neon Night", "Studio Garage"],
    },
  },
  required: ["make", "model", "year", "color", "category", "isOffroad", "orientation", "facingDirection"],
};

// ============================================================================
// ART GENERATION PROMPTS - SECRET
// ============================================================================

const BACKGROUND_PROMPTS: Record<string, string> = {
  'Studio Clean': "Clean studio solid matte background in neutral dark tone. Subtle reflective floor.",
  'Soft Gradient': "Soft gradient background, dark to lighter tones. Studio floor.",
  'Mountain Peaks': "Geometric mountain silhouettes with large minimalist Sun circle. Rocky gravel ground.",
  'Nordic Forest': "Nordic pine silhouettes in layered forest greens. Dark earth clearing foreground.",
  'Desert Dunes': "Vector canyon mesas and sand dunes in terracotta tones. Sandy ground.",
  'Topographic': "Technical topographic contour lines on matte background. Minimal ground line.",
  'City Skyline': "Minimalist city skyline silhouette in cool blue-gray. Asphalt street.",
  'Neon Night': "Dark urban nightscape with neon glows. Wet asphalt with reflections.",
  'Studio Garage': "Clean automotive studio with professional lighting. Polished concrete floor.",
};

const STANCE_PROMPTS: Record<string, string> = {
  'Stock': "Keep EXACT wheel design, tire size, and suspension height from source.",
  'Lifted + AT': "Add 2-3 inch lift with aggressive AT tires. Increase tire sidewall.",
  'Steelies + Mud': "Black steel wheels (steelies) with 33-inch mud-terrain tires. 2-inch lift.",
  'Lowered + Wheels': "Lower 1-2 inches, sportier stance. Add aftermarket wheels with low profile tires.",
};

const FIDELITY_PROMPTS: Record<string, string> = {
  'Exact Match': "EXACT MATCH: Include ALL stickers, decals, mud, dirt, scratches.",
  'Clean Build': "CLEAN BUILD: Keep all mods/stickers but remove dirt and imperfections.",
  'Factory Fresh': "FACTORY FRESH: Remove all aftermarket mods. Pure stock OEM look.",
};

export interface GenerateArtParams {
  analysis: VehicleAnalysis;
  style: string;
  background: string;
  fidelity: string;
  position: string;
  stance: string;
  selectedMods: string[];
  popularWheelName?: string;
}

export function buildBasePrompt(params: GenerateArtParams): string {
  const { analysis, style, background, fidelity, position, stance, selectedMods, popularWheelName } = params;
  
  // Position instructions
  const positionInstructions = position === 'As Photographed'
    ? `Keep the EXACT same angle and perspective as the source photo. Preserve orientation: ${analysis.orientation}, facing ${analysis.facingDirection}.`
    : `Convert to a CLEAN SIDE PROFILE view (90-degree lateral). Facing ${analysis.facingDirection}.`;

  // Stance with dynamic wheel info
  let stancePrompt = STANCE_PROMPTS[stance] || STANCE_PROMPTS['Stock'];
  if (stance === 'Lowered + Wheels' && popularWheelName) {
    stancePrompt = `Lower 1-2 inches, sportier stance. Add ${popularWheelName} with low profile tires.`;
  }

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
**CONDITION:** ${FIDELITY_PROMPTS[fidelity] || FIDELITY_PROMPTS['Clean Build']}
**STANCE:** ${stancePrompt}
**SCENE:** ${BACKGROUND_PROMPTS[background] || BACKGROUND_PROMPTS['Mountain Peaks']}
${accessories}
${mods}

═══════════════════════════════════════════════════════════
⚠️ CRITICAL: DO NOT INVENT OR ADD OBJECTS ⚠️
═══════════════════════════════════════════════════════════

ONLY reproduce what is ACTUALLY VISIBLE in the source photo.

DO NOT ADD:
✗ Bicycles, kayaks, surfboards, or any cargo - unless CLEARLY visible in the source
✗ People, animals, or figures
✗ Additional gear or equipment not shown in the photo
✗ Logos, text, or badges that don't exist in the source

If you see an EMPTY rack (bike rack, roof rack, etc.), draw it EMPTY.
If a rack has items attached, reproduce ONLY those exact items.

The goal is FAITHFUL REPRODUCTION of the source vehicle, not creative interpretation.

═══════════════════════════════════════════════════════════

**STYLE:** High-Fidelity Technical Vector Art. Clean lines, matte cel-shading.
${style === 'Poster Art' ? 'Editorial Poster Art aesthetic.' : 'Vector Badge/Sticker aesthetic.'}
Sharp vector paths, no photo textures. Premium wallpaper quality.
  `.trim();
}

// ============================================================================
// FORMAT-SPECIFIC PROMPTS - SECRET
// ============================================================================

interface FormatConfig {
  aspectRatio: string;
  orientation: string;
  composition: string;
  resolution: string;
}

const FORMAT_CONFIGS: Record<string, FormatConfig> = {
  phone: {
    aspectRatio: "9:16",
    orientation: "VERTICAL/PORTRAIT (9:16, taller than wide)",
    composition: `
      PHONE WALLPAPER COMPOSITION - EPIC LANDSCAPE STYLE:
      ═══════════════════════════════════════════════════════════
      ⚠️ THE VEHICLE MUST BE SMALL - THIS IS CRITICAL ⚠️
      ═══════════════════════════════════════════════════════════
      
      Think: National Geographic landscape photo with a tiny vehicle in the distance.
      Think: Photography from 80-100 meters away.
      Think: Epic adventure poster where the SCENERY is the hero.
      
      VEHICLE SIZE: Maximum 25-28% of image WIDTH (small!)
      VEHICLE POSITION: Center-lower area (55-60% down from top)
      
      The vehicle should feel like a small object in a VAST landscape.
      Lots of sky above for phone clock, widgets, and notch.
      The background/scenery should dominate the composition.
      
      This creates dramatic wallpaper with room for phone UI elements.
      ═══════════════════════════════════════════════════════════
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

export function buildFirstGenerationPrompt(basePrompt: string, format: 'phone' | 'desktop' | 'print'): string {
  const config = FORMAT_CONFIGS[format];
  
  return `
**FORMAT:** ${config.orientation}
**RESOLUTION:** ${config.resolution}

${config.composition}

${basePrompt}

**IMPORTANT:** This artwork will be used as the STYLE REFERENCE for other aspect ratios.
Create a distinctive, cohesive visual style that can be replicated.

**OUTPUT:** Generate a high-quality ${config.aspectRatio} vector art wallpaper.
  `.trim();
}

export function buildFollowUpGenerationPrompt(basePrompt: string, format: 'phone' | 'desktop' | 'print'): string {
  const config = FORMAT_CONFIGS[format];
  
  return `
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
}
