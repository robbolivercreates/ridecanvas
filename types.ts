export enum ArtStyle {
  POSTER = 'Poster Art',
  STICKER = 'Sticker Badge', 
}

// Expanded for ALL car types
export enum BackgroundTheme {
  // Clean / Minimal
  SOLID = 'Studio Clean',
  GRADIENT = 'Soft Gradient',
  
  // Nature / Adventure (for off-road)
  MOUNTAINS = 'Mountain Peaks',
  FOREST = 'Nordic Forest',
  DESERT = 'Desert Dunes',
  TOPO = 'Topographic',
  
  // Urban / Modern (for sports/luxury)
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

// Fidelity options - how clean/authentic the car should look
export enum FidelityMode {
  EXACT_MATCH = 'Exact Match',      // As photographed - dirt, stickers, everything
  CLEAN_BUILD = 'Clean Build',       // Keep mods/accessories, remove dirt/imperfections
  FACTORY_FRESH = 'Factory Fresh',   // Remove all aftermarket - stock vehicle
}

// Position/Angle options - how the car is oriented
export enum PositionMode {
  AS_PHOTOGRAPHED = 'As Photographed',  // Keep exact angle from photo
  SIDE_PROFILE = 'Side Profile',         // Convert to clean side profile
}

// Simplified stance options
export enum StanceStyle {
  STOCK = 'Stock',                    // Keep as-is
  // Off-road only
  LIFTED = 'Lifted + AT',             // Lifted with all-terrain tires
  STEELIES = 'Steelies + Mud',        // Steel wheels with mud tires
  // Non-off-road only  
  LOWERED = 'Lowered + Wheels',       // Lowered with popular aftermarket wheels
}

export enum CompositionStyle {
  HERO = 'Hero Shot',
  WALLPAPER = 'Wallpaper',
}

// NEW: Purpose-based output selection (replaces Composition + AspectRatio)
export enum OutputPurpose {
  PHONE = 'Phone',       // 9:16 vertical, 40% car, for lock screen
  DESKTOP = 'Desktop',   // 16:9 horizontal, 40% car, for desktop wallpaper
  PRINT = 'Print',       // 4:3 landscape, 40% car, for printing
}

export enum AspectRatio {
  MOBILE = '9:16',
  DESKTOP = '16:9',
  SQUARE = '1:1',
}

export enum Resolution {
  HD = '1K',
  FHD = '2K',
  UHD = '4K',
}

export interface PopularMod {
  id: string;
  name: string;
  description: string;
}

export interface PopularWheel {
  name: string;
  style: string;
}

// Wheel & Tire Audit - detailed inspection of wheels/tires
export interface WheelAudit {
  hasWhiteLettering: boolean;   // Does tire have white sidewall letters?
  hasCenterCaps: boolean;       // Are center caps visible?
  centerCapColor: string;       // Color of center caps (if visible)
  wheelColor: string;           // Main wheel color
  wheelFinish: string;          // matte, gloss, machined, polished
  wheelType: string;            // stock OEM, aftermarket alloy, steel wheels
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
  installedAccessories: string[];  // All visible accessories: mudguards, roof rack, bike rack, ladder, etc.
  geometryAudit: {
    bodyShape: string;
    windowLayout: string;
    frontDetail: string;
  };
  wheelAudit?: WheelAudit;  // Detailed wheel/tire inspection
  visualFeatures: {
    roofGear: string;
    wheelStyle: string;
    distinctiveMarkings: string;
  };
  // AI-suggested based on Google Search
  popularMods: PopularMod[];
  popularWheels: PopularWheel[];  // Popular wheel upgrades for this model
  suggestedStance: StanceStyle;
  suggestedBackground: BackgroundTheme;
}

export interface GenerationConfig {
  style: ArtStyle;
  background: BackgroundTheme;
  fidelity: FidelityMode;
  position: PositionMode;
  stance: StanceStyle;
  composition: CompositionStyle;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  outputPurpose: OutputPurpose;
  selectedMods: string[];
}
