import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { 
  Upload, Download, 
  RefreshCw, Mountain, Building2, Sparkles, Car,
  Smartphone, Monitor, Trees, Sun, Layers, Zap, Check,
  ChevronDown, Package, Printer, Camera, Aperture, Plus, FolderArchive,
  Scan, ChevronLeft, ChevronRight, Paintbrush, Wand2,
  Image, Palette, Settings2, CircleDot, Compass, Sunset, Building, 
  TreePine, Warehouse, Menu, X, Info, ShieldCheck, Mail
} from 'lucide-react';
import { 
  ArtStyle, BackgroundTheme, StanceStyle, 
  VehicleAnalysis, FidelityMode, PositionMode 
} from './types';
import { analyzeVehicle, generateArt, generateRemainingFormats, generateArtSet, fileToGenerativePart, GeneratedArtSet } from './services/geminiService';
import { redirectToCheckout, verifyPayment, checkPaymentStatus, clearPaymentParams } from './services/stripeService';

// ============ HAPTIC FEEDBACK UTILITY ============
const haptic = {
  // Visual feedback for buttons (since vibration isn't great on iOS)
  light: () => {
    // We use CSS active:scale transitions for this
  },
  success: () => {
    // Triggered on success actions
  },
  error: () => {
    // Triggered on error actions
  }
};

enum Step {
  UPLOAD = 1,
  ANALYZING = 2,
  CUSTOMIZE = 3,
  GENERATING = 4,
  PREVIEW = 5,
  COMPLETE = 6,
}

// Sub-steps within CUSTOMIZE for progressive disclosure
enum CustomizeStep {
  ANGLE = 1,
  SCENE = 2,
  STYLE = 3,
  EXTRAS = 4,
}

// ============ BEFORE/AFTER SLIDER COMPONENT ============
interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  autoAnimate?: boolean;
}

// Helper to create proper image src from base64 or URL
const getImageSrc = (image: string, defaultMime: string = 'image/png'): string => {
  if (!image) return '';
  
  // Already a complete data URL or regular URL
  if (image.startsWith('data:') || image.startsWith('/') || image.startsWith('http')) {
    return image;
  }
  
  // Clean the base64 string - remove any whitespace or newlines
  const cleanBase64 = image.replace(/[\s\n\r]/g, '');
  
  // Detect image type from base64 header
  // PNG starts with iVBOR, JPEG starts with /9j/
  let mimeType = defaultMime;
  if (cleanBase64.startsWith('/9j/') || cleanBase64.startsWith('/9J/')) {
    mimeType = 'image/jpeg';
  } else if (cleanBase64.startsWith('iVBOR')) {
    mimeType = 'image/png';
  }
  
  return `data:${mimeType};base64,${cleanBase64}`;
};

const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ 
  beforeImage, 
  afterImage, 
  beforeLabel = 'Before',
  afterLabel = 'After',
  autoAnimate = false
}) => {
  const [sliderPosition, setSliderPosition] = useState(autoAnimate ? 15 : 50);
  const [isDragging, setIsDragging] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-animate on mount: 100% → 15% (reveal 85% of the "After" image)
  useEffect(() => {
    if (autoAnimate && !hasAnimated) {
      // Start from 100% (showing full "Before")
      setSliderPosition(100);
      
      // After a brief pause, animate to 15%
      const timer = setTimeout(() => {
        const duration = 1500; // 1.5 seconds
        const startPosition = 100;
        const endPosition = 15;
        const startTime = performance.now();
        
        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Ease-out cubic for smooth deceleration
          const eased = 1 - Math.pow(1 - progress, 3);
          const newPosition = startPosition + (endPosition - startPosition) * eased;
          
          setSliderPosition(newPosition);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            setHasAnimated(true);
            setShowHint(true);
          }
        };
        
        requestAnimationFrame(animate);
      }, 800); // Wait 800ms before starting animation
      
      return () => clearTimeout(timer);
    }
  }, [autoAnimate, hasAnimated]);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
    setShowHint(false); // Hide hint once user interacts
  };

  const handleMouseDown = () => setIsDragging(true);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full rounded-2xl overflow-hidden cursor-ew-resize select-none touch-pan-y bg-black"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {/* After Image (full) - the generated art */}
      <img 
        src={afterImage}
        className="absolute inset-0 w-full h-full object-cover"
        alt="After"
        draggable={false}
      />
      
      {/* Before Image (clipped) */}
      <div 
        className="absolute inset-0 overflow-hidden transition-none"
        style={{ width: `${sliderPosition}%` }}
      >
        <div 
          className="absolute inset-0"
          style={{ width: sliderPosition > 0 ? `${100 / (sliderPosition / 100)}%` : '100%' }}
        >
          <img 
            src={beforeImage}
            className="w-full h-full object-cover"
            alt="Before"
            draggable={false}
          />
        </div>
        {/* Subtle vignette effect */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ 
            width: sliderPosition > 0 ? `${100 / (sliderPosition / 100)}%` : '100%',
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)'
          }}
        />
      </div>
      
      {/* Slider Line with glow effect */}
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
        style={{ 
          left: `${sliderPosition}%`, 
          transform: 'translateX(-50%)',
          boxShadow: '0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.3)'
        }}
      >
        {/* Slider Handle */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing border-2 border-white/20"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
          onMouseDown={handleMouseDown}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
        >
          <div className="flex items-center gap-0.5 text-black/70">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
            </svg>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
          </div>
        </div>
      </div>
      
      {/* Labels with fade-in animation */}
      <div className={`absolute top-4 left-4 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-full text-[10px] font-bold text-white transition-opacity duration-500 ${sliderPosition > 10 ? 'opacity-100' : 'opacity-0'}`}>
        {beforeLabel}
      </div>
      <div className={`absolute top-4 right-4 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 backdrop-blur-md rounded-full text-[10px] font-black text-black shadow-lg transition-opacity duration-500 ${sliderPosition < 90 ? 'opacity-100' : 'opacity-0'}`}>
        ✨ {afterLabel}
      </div>
    </div>
  );
};

// ============ GENERATING SCREEN COMPONENT ============
interface GeneratingScreenProps {
  imageBase64: string | null;
  analysis: VehicleAnalysis | null;
  statusMessage: string;
  background: BackgroundTheme;
  position: PositionMode;
  selectedMods: string[];
}

const GeneratingScreen: React.FC<GeneratingScreenProps> = ({
  imageBase64,
  analysis,
  statusMessage,
  background,
  position,
  selectedMods
}) => {
  const [revealStep, setRevealStep] = useState(0);

  // Progressive reveal of info
  useEffect(() => {
    const timers = [
      setTimeout(() => setRevealStep(1), 400),   // Vehicle
      setTimeout(() => setRevealStep(2), 900),   // Details
      setTimeout(() => setRevealStep(3), 1400),  // Settings
      setTimeout(() => setRevealStep(4), 1900),  // Rendering
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const getBackgroundName = (bg: BackgroundTheme) => {
    const names: Record<BackgroundTheme, string> = {
      [BackgroundTheme.SOLID]: 'Studio',
      [BackgroundTheme.MOUNTAINS]: 'Mountains',
      [BackgroundTheme.FOREST]: 'Forest',
      [BackgroundTheme.DESERT]: 'Desert',
      [BackgroundTheme.CITY]: 'Urban',
      [BackgroundTheme.NEON]: 'Neon',
      [BackgroundTheme.GRADIENT]: 'Gradient',
      [BackgroundTheme.TOPO]: 'Topographic',
      [BackgroundTheme.GARAGE]: 'Garage',
    };
    return names[bg] || 'Custom';
  };

  const InfoLine = ({ visible, children, isLoading = false }: { visible: boolean; children: React.ReactNode; isLoading?: boolean }) => (
    <div 
      className={`flex items-center gap-2 py-1.5 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      {isLoading ? (
        <div className="w-4 h-4 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
      ) : (
        <Check size={14} className="text-amber-500 flex-shrink-0" />
      )}
      <span className={`text-sm ${isLoading ? 'text-zinc-400' : 'text-white/80'}`}>{children}</span>
    </div>
  );

  return (
    <div className="pt-4 animate-fade-slide-in">
      {/* Preview of original image with overlay */}
      {imageBase64 && (
        <div className="relative aspect-[16/10] rounded-[2.5rem] overflow-hidden mb-8 bg-zinc-900 border border-white/5 shadow-2xl">
          <img 
            src={`data:image/jpeg;base64,${imageBase64}`}
            className="w-full h-full object-cover opacity-50"
            alt="Your vehicle"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-orange-500/10 animate-pulse" />
          
          {/* Center spinner */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-white/5 border-t-amber-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={32} className="text-amber-500 animate-pulse" />
              </div>
            </div>
          </div>
          
          {/* Corner brackets */}
          <div className="absolute top-6 left-6 w-8 h-8 border-l-2 border-t-2 border-amber-500/30" />
          <div className="absolute top-6 right-6 w-8 h-8 border-r-2 border-t-2 border-amber-500/30" />
          <div className="absolute bottom-6 left-6 w-8 h-8 border-l-2 border-b-2 border-amber-500/30" />
          <div className="absolute bottom-6 right-6 w-8 h-8 border-r-2 border-b-2 border-amber-500/30" />
        </div>
      )}
      
      {/* Title */}
      <div className="text-center mb-10 px-4">
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Creating your masterpiece</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">{statusMessage || 'This usually takes 10-15 seconds'}</p>
      </div>
      
      {/* Progressive info reveal in Liquid Glass Container */}
      <div className="liquid-glass rounded-[2.5rem] p-8 space-y-2 border border-white/10">
        <h3 className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[0.2em] mb-4">Art Generation Log</h3>
        <InfoLine visible={revealStep >= 1}>
          {analysis?.year} {analysis?.make} {analysis?.model} identified
        </InfoLine>
        
        <InfoLine visible={revealStep >= 2}>
          {analysis?.color} finish • {analysis?.isOffroad ? '4×4 logic active' : 'Street build logic'}
        </InfoLine>
        
        <InfoLine visible={revealStep >= 3}>
          {getBackgroundName(background)} environment • {position === PositionMode.SIDE_PROFILE ? 'Side profile' : 'Original perspective'}
        </InfoLine>
        
        <InfoLine visible={revealStep >= 4} isLoading={true}>
          {revealStep >= 4 ? 'Rendering 4K textures...' : 'Preparing scene...'}
        </InfoLine>
      </div>
    </div>
  );
};

// Scene options with beautiful gradients
const SCENES = [
  { id: BackgroundTheme.MOUNTAINS, name: 'Mountains', icon: Mountain, gradient: 'from-slate-600 via-blue-700 to-orange-400' },
  { id: BackgroundTheme.FOREST, name: 'Forest', icon: TreePine, gradient: 'from-emerald-800 to-green-500' },
  { id: BackgroundTheme.DESERT, name: 'Desert', icon: Sunset, gradient: 'from-amber-600 via-orange-500 to-yellow-400' },
  { id: BackgroundTheme.CITY, name: 'City', icon: Building, gradient: 'from-slate-800 via-slate-600 to-cyan-700' },
  { id: BackgroundTheme.NEON, name: 'Neon', icon: Zap, gradient: 'from-purple-800 via-pink-600 to-rose-500' },
  { id: BackgroundTheme.GARAGE, name: 'Garage', icon: Warehouse, gradient: 'from-zinc-700 via-zinc-600 to-zinc-500' },
];

// ============ SHOWCASE DATA ============
// Images are in /public/showcase/ folder
const SHOWCASE_DATA = [
  {
    id: 1,
    name: "VW California Beach",
    scene: "Mountain Peaks",
    before: "/showcase/before1.png",
    after: "/showcase/after1.png"
  },
  {
    id: 2,
    name: "Land Rover LR4",
    scene: "Desert Dunes",
    before: "/showcase/before2.png",
    after: "/showcase/after2.png"
  },
  {
    id: 3,
    name: "Jeep Wrangler",
    scene: "Forest Trail",
    before: "/showcase/before3.png",
    after: "/showcase/after3.png"
  }
];

const App: React.FC = () => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const mobileCarouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    const scrollAmount = 300; // Adjusted for slide width
    const targetRef = carouselRef.current || mobileCarouselRef.current;
    if (!targetRef) return;
    targetRef.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(Step.UPLOAD);
  
  // Main visible options
  const [background, setBackground] = useState<BackgroundTheme>(BackgroundTheme.MOUNTAINS);
  const [position, setPosition] = useState<PositionMode>(PositionMode.SIDE_PROFILE); // Default: Side Profile
  const [customCity, setCustomCity] = useState<string>(''); // Custom city for City Skyline background
  
  // Advanced options (collapsed)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fidelity, setFidelity] = useState<FidelityMode>(FidelityMode.CLEAN_BUILD);
  const [stance, setStance] = useState<StanceStyle>(StanceStyle.STOCK);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  
  // Data
  const [analysis, setAnalysis] = useState<VehicleAnalysis | null>(null);
  const [previewArt, setPreviewArt] = useState<string | null>(null);
  const [artSet, setArtSet] = useState<GeneratedArtSet | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  
  // Scan animation state
  const [scanStep, setScanStep] = useState(0);
  const [showMods, setShowMods] = useState(false);
  
  // Customize sub-step for progressive disclosure
  const [customizeStep, setCustomizeStep] = useState<CustomizeStep>(CustomizeStep.ANGLE);
  
  // Menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Payment
  const [hasPaid, setHasPaid] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // DEV MODE - bypass paywall with ?dev=1
  const isDevMode = new URLSearchParams(window.location.search).get('dev') === '1';
  
  // DEMO MODE - clean interface for recording content
  // Activated by: ?demo=1 OR /cx path OR localStorage flag OR Easter Egg (5 taps on logo)
  const [easterEggActive, setEasterEggActive] = useState(
    localStorage.getItem('gc_demo_mode') === 'true'
  );
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [showEasterEggToast, setShowEasterEggToast] = useState(false);
  const logoTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === '1' 
    || window.location.pathname === '/cx'
    || window.location.pathname === '/cx/'
    || easterEggActive;
  
  // Easter Egg: 5 taps on logo within 3 seconds activates demo mode
  const handleLogoTap = () => {
    const newCount = logoTapCount + 1;
    setLogoTapCount(newCount);
    
    // Clear previous timer
    if (logoTapTimerRef.current) {
      clearTimeout(logoTapTimerRef.current);
    }
    
    // Check if we hit 5 taps
    if (newCount >= 5) {
      const newDemoState = !easterEggActive;
      setEasterEggActive(newDemoState);
      
      if (newDemoState) {
        localStorage.setItem('gc_demo_mode', 'true');
      } else {
        localStorage.removeItem('gc_demo_mode');
      }
      
      // Show toast
      setShowEasterEggToast(true);
      setTimeout(() => setShowEasterEggToast(false), 2000);
      
      // Reset counter
      setLogoTapCount(0);
      return;
    }
    
    // Reset counter after 3 seconds of inactivity
    logoTapTimerRef.current = setTimeout(() => {
      setLogoTapCount(0);
    }, 3000);
  };

  // Check for payment return on mount
  useEffect(() => {
    const { sessionId, cancelled } = checkPaymentStatus();
    if (sessionId) handlePaymentReturn(sessionId);
    else if (cancelled) {
      clearPaymentParams();
      setStep(Step.PREVIEW);
    }
  }, []);

  // Apply AI suggestions when analysis completes
  useEffect(() => {
    if (analysis) {
      if (analysis.suggestedBackground) {
        setBackground(analysis.suggestedBackground);
      }
      // Stance default is always Stock - don't override
      // Reset customize step for new session
      setCustomizeStep(CustomizeStep.ANGLE);
    }
  }, [analysis]);

  // Progressive reveal during analysis
  useEffect(() => {
    if (step === Step.ANALYZING && analysis) {
      // Reveal info progressively
      const timers = [
        setTimeout(() => setScanStep(1), 300),   // Make + Model
        setTimeout(() => setScanStep(2), 800),   // Year + Color
        setTimeout(() => setScanStep(3), 1300),  // Category
        setTimeout(() => setScanStep(4), 1800),  // Accessories
        setTimeout(() => {
          setScanStep(5);
          // Transition to customize after reveal
          setTimeout(() => setStep(Step.CUSTOMIZE), 600);
        }, 2300),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [step, analysis]);

  const handlePaymentReturn = async (sessionId: string) => {
    setIsProcessingPayment(true);
    setStatusMessage("Verifying payment...");
    setStep(Step.GENERATING);
    
    try {
      const result = await verifyPayment(sessionId);
      clearPaymentParams();
      
      if (result.success) {
        const savedState = localStorage.getItem('garagecanvas_pending_art');
        if (savedState) {
          const state = JSON.parse(savedState);
          setImageBase64(state.imageBase64);
          setAnalysis(state.analysis);
          setBackground(state.background);
          setPosition(state.position);
          setFidelity(state.fidelity);
          setStance(state.stance);
          setSelectedMods(state.selectedMods || []);
          
          const existingPreview = state.previewArt;
          
          if (existingPreview) {
            setStatusMessage("Creating remaining formats...");
            const set = await generateRemainingFormats(
              state.imageBase64, 
              existingPreview,
              state.analysis, 
              ArtStyle.POSTER, 
              state.background, 
              state.fidelity || FidelityMode.CLEAN_BUILD, 
              state.position || PositionMode.AS_PHOTOGRAPHED,
              state.stance || StanceStyle.STOCK, 
              state.selectedMods || [],
              (progress) => setStatusMessage(progress),
              state.customCity || undefined
            );
            setArtSet(set);
          } else {
            setStatusMessage("Creating all formats...");
            const set = await generateArtSet(
              state.imageBase64, 
              state.analysis, 
              ArtStyle.POSTER, 
              state.background, 
              state.fidelity || FidelityMode.CLEAN_BUILD, 
              state.position || PositionMode.AS_PHOTOGRAPHED,
              state.stance || StanceStyle.STOCK, 
              state.selectedMods || [],
              (progress) => setStatusMessage(progress),
              state.customCity || undefined
            );
            setArtSet(set);
          }
          
          setPreviewArt(existingPreview);
          setHasPaid(true);
          setStep(Step.COMPLETE);
          localStorage.removeItem('garagecanvas_pending_art');
        }
      } else {
        throw new Error('Payment not verified');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment verification failed. Please contact support.');
      setStep(Step.PREVIEW);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    haptic.light(); // Haptic on file select
    
    // Show loading state immediately
    setStep(Step.ANALYZING);
    setStatusMessage("Processing your photo...");
    
    try {
      console.log('Processing file:', file.name, file.type, file.size);
      const base64 = await fileToGenerativePart(file);
      console.log('File processed, base64 length:', base64.length);
      
      setImageBase64(base64);
      setPreviewArt(null);
      setArtSet(null);
      setHasPaid(false);
      setSelectedMods([]);
      setScanStep(0);
      
      try {
        const res = await analyzeVehicle(base64);
        setAnalysis(res);
        haptic.success(); // Haptic on analysis complete
        // Don't transition yet - let the scan animation play
      } catch (err) {
        console.error('Analysis error:', err);
        haptic.error(); // Haptic on error
        setStep(Step.UPLOAD);
        alert("Couldn't analyze that image. Try a clearer photo.");
      }
    } catch (err) {
      console.error('File processing error:', err);
      haptic.error();
      setStep(Step.UPLOAD);
      alert("Couldn't process that image. Please try a different photo.");
    }
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleGenerate = async () => {
    if (!imageBase64 || !analysis) return;
    haptic.light(); // Haptic on button press
    setStep(Step.GENERATING);
    setStatusMessage("Creating your artwork...");
    
    try {
      const art = await generateArt(
        imageBase64, analysis, ArtStyle.POSTER, background, 
        fidelity, position, stance, selectedMods,
        background === BackgroundTheme.CITY ? customCity : undefined
      );
      setPreviewArt(art);
      haptic.success(); // Haptic on art complete!
      setStep(Step.PREVIEW);
    } catch (err) {
      console.error('Generation error:', err);
      haptic.error();
      setStep(Step.CUSTOMIZE);
      alert("Generation failed. Please try again.");
    }
  };

  const handlePurchase = async () => {
    if (!imageBase64 || !analysis || !previewArt) return;
    setIsProcessingPayment(true);
    
    try {
      localStorage.setItem('garagecanvas_pending_art', JSON.stringify({
        imageBase64, analysis, background, fidelity, position, stance, selectedMods,
        previewArt, customCity
      }));
      
      await redirectToCheckout(
        `art_${Date.now()}`,
        `${analysis.year} ${analysis.make} ${analysis.model}`
      );
    } catch (err) {
      console.error('Checkout error:', err);
      setIsProcessingPayment(false);
      alert("Checkout failed. Please try again.");
    }
  };

  // DEV MODE: Skip payment and generate all formats
  const handleDevUnlock = async () => {
    if (!imageBase64 || !analysis || !previewArt) return;
    setIsProcessingPayment(true);
    setStep(Step.GENERATING);
    setStatusMessage("DEV MODE: Generating all formats...");
    
    try {
      const set = await generateRemainingFormats(
        imageBase64, 
        previewArt,
        analysis, 
        ArtStyle.POSTER, 
        background, 
        fidelity, 
        position,
        stance, 
        selectedMods,
        (progress) => setStatusMessage(`DEV: ${progress}`),
        background === BackgroundTheme.CITY ? customCity : undefined
      );
      setArtSet(set);
      setHasPaid(true);
      setStep(Step.COMPLETE);
    } catch (err) {
      console.error('Dev generation error:', err);
      alert("Generation failed.");
      setStep(Step.PREVIEW);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDownload = async (format: 'phone' | 'desktop' | 'print') => {
    if (!artSet || !analysis) return;
    haptic.success(); // Haptic on download
    
    // Use correct mimeType and extension
    const mimeType = artSet.mimeType || 'image/png';
    const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const fileName = `GarageCanvas-${analysis.make}-${analysis.model}-${format}-4K.${extension}`;
    const base64Data = artSet[format];
    
    // Convert base64 to blob for sharing
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });
    
    // Try Web Share API first (iOS can save to gallery)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'GarageCanvas Art',
        });
        return;
      } catch (err) {
        console.log('Share cancelled, falling back to download');
      }
    }
    
    // Fallback: regular download
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${base64Data}`;
    link.download = fileName;
    link.click();
  };

  const handleDownloadZip = async () => {
    if (!artSet || !analysis) return;
    setIsDownloading(true);
    
    try {
      const zip = new JSZip();
      const vehicleName = `${analysis.year}-${analysis.make}-${analysis.model}`.replace(/\s+/g, '-');
      
      // Use correct extension based on mimeType
      const extension = (artSet.mimeType?.includes('jpeg') || artSet.mimeType?.includes('jpg')) ? 'jpg' : 'png';
      
      const addToZip = (base64: string, filename: string) => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        zip.file(filename, byteArray);
      };
      
      addToZip(artSet.phone, `GarageCanvas-${vehicleName}-Phone-4K.${extension}`);
      addToZip(artSet.desktop, `GarageCanvas-${vehicleName}-Desktop-4K.${extension}`);
      addToZip(artSet.print, `GarageCanvas-${vehicleName}-Print-4K.${extension}`);
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `GarageCanvas-${vehicleName}-4K-Pack.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ZIP error:', err);
      alert('Failed to create ZIP. Try downloading individually.');
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleMod = (modName: string) => {
    setSelectedMods(prev => 
      prev.includes(modName) 
        ? prev.filter(m => m !== modName)
        : [...prev, modName]
    );
  };

  const startNew = () => {
    setImageBase64(null);
    setPreviewArt(null);
    setArtSet(null);
    setAnalysis(null);
    setHasPaid(false);
    setShowAdvanced(false);
    setShowMods(false);
    setSelectedMods([]);
    setScanStep(0);
    setStep(Step.UPLOAD);
  };

  const getStanceOptions = () => {
    // Simplified to just 2 options: Stock + one contextual option
    if (analysis?.isOffroad) {
      return [
        { id: StanceStyle.STOCK, label: 'As It Sits', desc: 'Keep current height', icon: '🚗' },
        { id: StanceStyle.LIFTED, label: 'Lifted', desc: 'Higher + bigger tires', icon: '🏔️' },
      ];
    }
    return [
      { id: StanceStyle.STOCK, label: 'As It Sits', desc: 'Keep current stance', icon: '🚗' },
      { id: StanceStyle.LOWERED, label: 'Lowered', desc: 'Street stance look', icon: '🏎️' },
    ];
  };

  // Info Pill Component for scan animation
  const InfoPill = ({ visible, delay, children }: { visible: boolean; delay: number; children: React.ReactNode }) => (
    <div 
      className={`transition-all duration-400 ${visible ? 'animate-slide-up' : 'opacity-0 translate-y-2'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="bg-black/70 backdrop-blur-sm border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs font-medium text-white/90 flex items-center gap-2">
        <Check size={12} className="text-amber-500" />
        {children}
      </div>
    </div>
  );

  // ============ MAIN APP ============
  return (
    <div className="min-h-screen bg-black text-white">
      
      {/* Header */}
      <header 
        className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-lg md:max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo with Easter Egg - 5 taps to toggle demo mode */}
          <button 
            onClick={handleLogoTap}
            className={`flex items-center gap-3 transition-all duration-200 ${
              logoTapCount > 0 ? 'scale-95' : ''
            } ${logoTapCount >= 3 ? 'opacity-70' : ''}`}
          >
            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center transition-all duration-300 shadow-lg shadow-orange-500/20 ${
              logoTapCount >= 4 || isDemoMode ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black' : ''
            }`}>
              <Car size={20} className="text-white" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-bold text-base leading-tight tracking-tight">TheGarageCanvas</span>
              {isDemoMode && (
                <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-tighter leading-none mt-0.5">Creator Mode 🔓</span>
              )}
            </div>
          </button>
          
          <div className="flex items-center gap-2">
            {step !== Step.UPLOAD && (
              <button 
                onClick={startNew}
                className="h-10 px-4 rounded-full bg-zinc-900/50 border border-white/10 text-xs font-bold text-white hover:bg-zinc-800 transition-all flex items-center gap-2 btn-press active:scale-95"
              >
                <Plus size={16} className="text-amber-500" />
                NEW
              </button>
            )}
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="w-12 h-12 flex items-center justify-center text-zinc-400 hover:text-white transition-colors active:scale-90"
            >
              <Menu size={28} />
            </button>
          </div>
        </div>
      </header>

      {/* Menu Drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Drawer Content */}
          <div className="relative w-full max-w-xs h-full bg-zinc-950 border-l border-white/10 shadow-2xl animate-slide-in-right flex flex-col">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <span className="font-semibold text-lg">Menu</span>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* FAQ Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">FAQ</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1">What do I get for $3.99?</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">3 high-resolution 4K images: Phone wallpaper, Desktop wallpaper, and Print-ready (4:3).</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1">How long does it take?</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">About 60 seconds to analyze and generate all 3 formats.</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1">Refund policy?</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">All sales are final once images are generated. Preview your art for free before purchasing.</p>
                  </div>
                </div>
              </div>

              {/* Legal/Links */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <button className="flex items-center gap-3 text-sm text-zinc-400 hover:text-white transition-colors w-full text-left">
                  <ShieldCheck size={18} />
                  Privacy Policy
                </button>
                <button className="flex items-center gap-3 text-sm text-zinc-400 hover:text-white transition-colors w-full text-left">
                  <Info size={18} />
                  Terms of Service
                </button>
                <a 
                  href="mailto:hello@thegaragecanvas.art"
                  className="flex items-center gap-3 text-sm text-zinc-400 hover:text-white transition-colors w-full text-left"
                >
                  <Mail size={18} />
                  Contact Support
                </a>
              </div>

              {/* Developer Mode Toggle in Menu */}
              {isDemoMode && (
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Creator Mode</h3>
                  <button 
                    onClick={() => {
                      setEasterEggActive(false);
                      localStorage.removeItem('gc_demo_mode');
                      setIsMenuOpen(false);
                      window.location.href = window.location.pathname; // Clear query params
                    }}
                    className="flex items-center gap-3 text-sm text-zinc-400 hover:text-white transition-colors w-full text-left"
                  >
                    <RefreshCw size={18} className="text-amber-500" />
                    Reset to Normal Mode
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/5 text-center">
              <p className="text-[10px] text-zinc-700">© 2024 TheGarageCanvas.Art</p>
              <p className="text-[10px] text-zinc-800 mt-1">Made with 🧡 for car enthusiasts</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Easter Egg Toast */}
      {showEasterEggToast && (
        <div 
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-bounce-in"
          style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-black px-4 py-2 rounded-full font-semibold text-sm shadow-lg shadow-amber-500/30 flex items-center gap-2">
            {easterEggActive ? (
              <>🔓 Studio Mode</>
            ) : (
              <>🔒 Normal Mode</>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main 
        className="pb-8 px-4 max-w-lg md:max-w-5xl mx-auto"
        style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}
      >
        
        {/* ============ UPLOAD ============ */}
        {step === Step.UPLOAD && (
          <div className="animate-fade-slide-in">
            {/* Hero Section */}
            <div className="text-center pt-6 md:pt-12 pb-6 md:pb-10">
              <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-3 md:mb-4">
                Automotive AI Art Studio
              </div>
              <h1 className="text-3xl md:text-6xl font-black tracking-tight mb-4 md:mb-6 px-4">
                Turn Your Ride <br />
                <span className="bg-gradient-to-r from-amber-200 via-amber-500 to-orange-600 bg-clip-text text-transparent">
                  Into A Masterpiece
                </span>
              </h1>
              <p className="text-zinc-400 text-xs md:text-lg max-w-[260px] md:max-w-2xl mx-auto leading-relaxed">
                Turn your ride into a masterpiece, training thousands of iconic builds. <br className="hidden md:block" />
                Create premium 4K art of your vehicle.
              </p>
            </div>

            {/* Premium Upload Zone */}
            <label 
              htmlFor="file-upload"
              className="relative aspect-square w-full max-w-[280px] md:max-w-[500px] mx-auto mb-10 md:mb-16 rounded-[2rem] md:rounded-[4rem] liquid-glass flex flex-col items-center justify-center p-6 md:p-12 transition-all duration-500 animate-breathing-glow cursor-pointer btn-press active:scale-[0.98]"
            >
              <input 
                id="file-upload"
                type="file" 
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                onChange={handleFile} 
              />
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-orange-500/20 mb-6 animate-float pointer-events-none">
                <Upload size={32} className="text-white" />
              </div>
              
              <h2 className="text-xl font-bold mb-2 pointer-events-none">Drop Your Ride</h2>
              <p className="text-zinc-500 text-xs mb-8 pointer-events-none">or tap to browse your gallery</p>
              
              <div className="flex items-center gap-4 text-zinc-400 pointer-events-none">
                <div className="flex flex-col items-center gap-1">
                  <Smartphone size={16} />
                  <span className="text-[9px] font-medium">Phone</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex flex-col items-center gap-1">
                  <Monitor size={16} />
                  <span className="text-[9px] font-medium">Desktop</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex flex-col items-center gap-1">
                  <Printer size={16} />
                  <span className="text-[9px] font-medium">Print</span>
                </div>
              </div>
            </label>

            {/* Showcase Section */}
            <div className="space-y-4 md:space-y-6 mb-8 md:mb-12 relative group">
              <div className="flex items-center justify-center px-2">
                <h3 className="text-[10px] md:text-sm font-black uppercase tracking-[0.3em] text-amber-500/80">Explore The Gallery</h3>
              </div>
              
              {/* Navigation Arrows - Mobile: Top */}
              <div className="flex md:hidden items-center justify-center gap-3 mb-4">
                <button 
                  onClick={() => scrollCarousel('left')}
                  className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all active:scale-90 flex"
                >
                  <ChevronLeft size={20} />
                </button>
                <button 
                  onClick={() => scrollCarousel('right')}
                  className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all active:scale-90 flex"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Desktop: Buttons outside container */}
              <div className="hidden md:flex items-center gap-4 px-2">
                <button 
                  onClick={() => scrollCarousel('left')}
                  className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/10 items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all active:scale-90 flex flex-shrink-0 z-20 shadow-xl shadow-black/50"
                >
                  <ChevronLeft size={24} />
                </button>
                
                <div className="relative flex-1 overflow-hidden rounded-[3rem]">
                  {/* Left Gradient Cover */}
                  <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black via-black/40 to-transparent z-10 pointer-events-none" />
                  
                  {/* Right Gradient Cover */}
                  <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black via-black/40 to-transparent z-10 pointer-events-none" />

                  {/* Horizontal Scroll Carousel */}
                  <div 
                    ref={carouselRef}
                    className="flex gap-8 overflow-x-auto pb-4 pt-4 px-[calc(50%-250px)] snap-x snap-mandatory no-scrollbar scroll-smooth"
                  >
                {SHOWCASE_DATA.map((example) => (
                  <div key={example.id} className="min-w-[300px] md:min-w-[500px] snap-center">
                    <div className="relative aspect-[4/3] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-zinc-900 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] transform transition-transform duration-500 hover:scale-[1.02]">
                      <BeforeAfterSlider 
                        beforeImage={example.before} 
                        afterImage={example.after}
                        beforeLabel="Photo"
                        afterLabel="AI Art"
                        autoAnimate={true}
                      />
                    </div>
                  </div>
                ))}
                  </div>
                </div>
                
                <button 
                  onClick={() => scrollCarousel('right')}
                  className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/10 items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all active:scale-90 flex flex-shrink-0 z-20 shadow-xl shadow-black/50"
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              {/* Mobile: Carousel container */}
              <div className="relative md:hidden overflow-hidden">
                {/* Left Gradient Cover */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/60 to-transparent z-10 pointer-events-none" />
                
                {/* Right Gradient Cover */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/60 to-transparent z-10 pointer-events-none" />

                <div 
                  ref={mobileCarouselRef}
                  className="flex gap-4 overflow-x-auto pb-4 pt-2 px-[calc(50%-150px)] snap-x snap-mandatory no-scrollbar scroll-smooth"
                >
                {SHOWCASE_DATA.map((example) => (
                  <div key={`mobile-${example.id}`} className="min-w-[300px] snap-center">
                    <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden bg-zinc-900 border border-white/5 shadow-2xl shadow-black/50">
                      <BeforeAfterSlider 
                        beforeImage={example.before} 
                        afterImage={example.after}
                        beforeLabel="Photo"
                        afterLabel="AI Art"
                        autoAnimate={true}
                      />
                    </div>
                  </div>
                ))}
                </div>
              </div>
              
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-2 md:gap-4 py-6 md:py-8 border-t border-white/5">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mb-2">
                  <Zap size={18} className="text-amber-500" />
                </div>
                <span className="text-[10px] font-bold text-white mb-1 uppercase tracking-wider">Instant</span>
                <p className="text-[8px] text-zinc-600">60s turnaround</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mb-2">
                  <Sparkles size={18} className="text-amber-500" />
                </div>
                <span className="text-[10px] font-bold text-white mb-1 uppercase tracking-wider">Premium AI</span>
                <p className="text-[8px] text-zinc-600">Automotive logic</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mb-2">
                  <ShieldCheck size={18} className="text-amber-500" />
                </div>
                <span className="text-[10px] font-bold text-white mb-1 uppercase tracking-wider">One-Time</span>
                <p className="text-[8px] text-zinc-600">No subscriptions</p>
              </div>
            </div>
          </div>
        )}

        {/* ============ ANALYZING (with scan animation) ============ */}
        {step === Step.ANALYZING && imageBase64 && (
          <div className="pt-4 animate-fade-slide-in">
            {/* Image with scan overlay */}
            <div className="relative aspect-[16/10] rounded-[2.5rem] overflow-hidden mb-8 border border-white/5 shadow-2xl scanner-corners">
              <img 
                src={`data:image/jpeg;base64,${imageBase64}`}
                className="w-full h-full object-cover opacity-80"
                alt="Your vehicle"
              />
              
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/20" />
              
              {/* Scan line */}
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-b from-transparent via-amber-500 to-transparent animate-scan" style={{ top: '0%' }}>
                <div className="absolute inset-x-0 h-40 bg-gradient-to-b from-amber-500/20 to-transparent" />
              </div>
              
              {/* Scanning indicator */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <Scan size={16} className="text-amber-500 animate-pulse" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Scanning Build</span>
              </div>
              
              {/* Progressive info reveals */}
              <div className="absolute bottom-6 left-6 right-6 space-y-2">
                {analysis && (
                  <>
                    <InfoPill visible={scanStep >= 1} delay={0}>
                      {analysis.make} {analysis.model}
                    </InfoPill>
                    <InfoPill visible={scanStep >= 2} delay={100}>
                      {analysis.year} • {analysis.color}
                    </InfoPill>
                    <InfoPill visible={scanStep >= 3} delay={200}>
                      {analysis.isOffroad ? '4×4 Architecture' : analysis.category}
                    </InfoPill>
                    {analysis.installedAccessories && analysis.installedAccessories.length > 0 && (
                      <InfoPill visible={scanStep >= 4} delay={300}>
                        {analysis.installedAccessories.slice(0, 3).join(' • ')}
                      </InfoPill>
                    )}
                  </>
                )}
              </div>
            </div>
            
            {!analysis && (
              <div className="text-center py-4">
                <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-white/5 border-t-amber-500 animate-spin" />
                <p className="text-zinc-500 text-sm font-medium tracking-tight">Deconstructing pixels...</p>
              </div>
            )}
          </div>
        )}

        {/* ============ CUSTOMIZE ============ */}
        {step === Step.CUSTOMIZE && analysis && (
          <div className="pt-4 animate-fade-slide-in">
            {/* Minimal Car Preview */}
            <div className="relative aspect-[16/10] rounded-3xl overflow-hidden mb-8 border border-white/5 shadow-2xl">
              <img 
                src={`data:image/jpeg;base64,${imageBase64}`}
                className="w-full h-full object-cover opacity-60"
                alt="Your car"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
              <div className="absolute bottom-4 left-6 text-left">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Detected Build</p>
                <h2 className="text-xl font-bold text-white tracking-tight">{analysis.year} {analysis.make} {analysis.model}</h2>
              </div>
            </div>

            {/* Visual Stepper */}
            <div className="flex justify-between items-center mb-10 px-2">
              {[
                { id: CustomizeStep.ANGLE, icon: Compass, label: 'Angle' },
                { id: CustomizeStep.SCENE, icon: Image, label: 'Scene' },
                { id: CustomizeStep.STYLE, icon: Settings2, label: 'Style' },
                { id: CustomizeStep.EXTRAS, icon: Wand2, label: 'Extras' },
              ].map((item, index) => {
                const isActive = customizeStep === item.id;
                const isCompleted = [CustomizeStep.ANGLE, CustomizeStep.SCENE, CustomizeStep.STYLE, CustomizeStep.EXTRAS].indexOf(customizeStep) > index;
                const Icon = item.icon;
                return (
                  <React.Fragment key={item.id}>
                    <button
                      onClick={() => {
                        haptic.light();
                        setCustomizeStep(item.id);
                      }}
                      className={`flex flex-col items-center transition-all ${
                        isActive ? 'scale-110' : 'opacity-40 hover:opacity-80'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-all duration-500 ${
                        isActive 
                          ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' 
                          : isCompleted 
                            ? 'bg-zinc-800 text-amber-500' 
                            : 'bg-zinc-900 text-zinc-600'
                      }`}>
                        {isCompleted ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                        isActive ? 'text-white' : 'text-zinc-600'
                      }`}>
                        {item.label}
                      </span>
                    </button>
                    {index < 3 && (
                      <div className={`flex-1 h-[2px] mx-2 mt-[-18px] transition-colors duration-500 ${
                        [CustomizeStep.ANGLE, CustomizeStep.SCENE, CustomizeStep.STYLE, CustomizeStep.EXTRAS].indexOf(customizeStep) > index 
                          ? 'bg-amber-500/30' 
                          : 'bg-zinc-900'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Content Container */}
            <div className="liquid-glass rounded-[2.5rem] p-8 mb-10 min-h-[320px] flex flex-col justify-center">
              {/* ─────────────── STEP 1: ANGLE ─────────────── */}
              {customizeStep === CustomizeStep.ANGLE && (
                <div className="animate-fade-slide-in text-left">
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-bold mb-2 tracking-tight text-white">Choose the Angle</h3>
                    <p className="text-sm text-zinc-500">How should your car be shown?</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => setPosition(PositionMode.SIDE_PROFILE)}
                      className={`relative p-5 rounded-3xl transition-all text-left flex items-center gap-5 ${
                        position === PositionMode.SIDE_PROFILE
                          ? 'bg-zinc-800/80 ring-2 ring-amber-500 shadow-xl'
                          : 'bg-white/5 hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                        position === PositionMode.SIDE_PROFILE ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-500'
                      }`}>
                        <Aperture size={28} />
                      </div>
                      <div className="flex-1">
                        <span className="font-bold text-lg block mb-1">Side Profile</span>
                        <p className="text-xs text-zinc-500 leading-tight">
                          Classic poster look • Clean & balanced
                        </p>
                      </div>
                      {position === PositionMode.SIDE_PROFILE && (
                        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                          <Check size={14} className="text-black" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                    
                    <button
                      onClick={() => setPosition(PositionMode.AS_PHOTOGRAPHED)}
                      className={`relative p-5 rounded-3xl transition-all text-left flex items-center gap-5 ${
                        position === PositionMode.AS_PHOTOGRAPHED
                          ? 'bg-zinc-800/80 ring-2 ring-amber-500 shadow-xl'
                          : 'bg-white/5 hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                        position === PositionMode.AS_PHOTOGRAPHED ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-500'
                      }`}>
                        <Camera size={28} />
                      </div>
                      <div className="flex-1">
                        <span className="font-bold text-lg block mb-1">As Photographed</span>
                        <p className="text-xs text-zinc-500 leading-tight">
                          Keep your exact angle • Unique perspective
                        </p>
                      </div>
                      {position === PositionMode.AS_PHOTOGRAPHED && (
                        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                          <Check size={14} className="text-black" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ─────────────── STEP 2: SCENE ─────────────── */}
              {customizeStep === CustomizeStep.SCENE && (
                <div className="animate-fade-slide-in text-left">
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-bold mb-2 tracking-tight text-white">Pick a Scene</h3>
                    <p className="text-sm text-zinc-500">Where should your car be?</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {SCENES.map((scene) => {
                      const isSelected = background === scene.id;
                      const Icon = scene.icon;
                      return (
                        <button
                          key={scene.id}
                          onClick={() => {
                            setBackground(scene.id);
                            // Clear custom city when switching away from City
                            if (scene.id !== BackgroundTheme.CITY) {
                              setCustomCity('');
                            }
                          }}
                          className={`relative aspect-square rounded-[1.5rem] overflow-hidden transition-all duration-300 ${
                            isSelected 
                              ? 'ring-2 ring-amber-500 ring-offset-4 ring-offset-black scale-105 z-10 shadow-2xl shadow-amber-500/20' 
                              : 'opacity-40 hover:opacity-100 hover:scale-105 bg-white/5'
                          }`}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${scene.gradient}`} />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Icon size={26} className="text-white mb-2" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">{scene.name}</span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                              <Check size={12} className="text-black" strokeWidth={4} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Custom City Input - shown when City Skyline is selected */}
                  {background === BackgroundTheme.CITY && (
                    <div className="mt-6 animate-fade-slide-in">
                      <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[0.2em] mb-3 block text-center">
                        Which City?
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={customCity}
                          onChange={(e) => setCustomCity(e.target.value)}
                          placeholder="e.g. Tokyo, Dubai, New York..."
                          className="w-full px-5 py-4 bg-zinc-900/80 border border-white/10 rounded-2xl text-white text-center placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                        />
                        {customCity && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <Check size={12} className="text-amber-500" />
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-600 text-center mt-2">
                        We'll create a skyline with famous landmarks from your city
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ─────────────── STEP 3: STYLE ─────────────── */}
              {customizeStep === CustomizeStep.STYLE && (
                <div className="animate-fade-slide-in text-left">
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-bold mb-2 tracking-tight text-white">Set the Style</h3>
                    <p className="text-sm text-zinc-500">How clean or detailed?</p>
                  </div>
                  
                  {/* Condition */}
                  <div className="mb-8">
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[0.2em] mb-4 block text-center">Condition</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: FidelityMode.EXACT_MATCH, label: 'As-is', desc: 'Real state', icon: CircleDot },
                        { id: FidelityMode.CLEAN_BUILD, label: 'Clean', desc: 'Detailed', icon: Paintbrush },
                        { id: FidelityMode.FACTORY_FRESH, label: 'Stock', desc: 'Showroom', icon: Car },
                      ].map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = fidelity === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => setFidelity(opt.id)}
                            className={`p-4 rounded-3xl text-center transition-all ${
                              isSelected
                                ? 'bg-zinc-800/80 ring-2 ring-amber-500 shadow-xl'
                                : 'bg-white/5 hover:bg-white/10 border border-white/5'
                            }`}
                          >
                            <Icon size={20} className={`mx-auto mb-2 ${isSelected ? 'text-amber-500' : 'text-zinc-600'}`} />
                            <div className="text-sm font-bold text-white mb-0.5">{opt.label}</div>
                            <div className="text-[9px] text-zinc-500 font-medium leading-tight">{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stance */}
                  <div>
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[0.2em] mb-4 block text-center">Ride Height</label>
                    <div className="grid grid-cols-2 gap-4">
                      {getStanceOptions().map((opt) => {
                        const isSelected = stance === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => setStance(opt.id)}
                            className={`p-5 rounded-3xl text-center transition-all flex flex-col items-center ${
                              isSelected
                                ? 'bg-zinc-800/80 ring-2 ring-amber-500 shadow-xl'
                                : 'bg-white/5 hover:bg-white/10 border border-white/5'
                            }`}
                          >
                            <span className="text-3xl mb-3">{opt.icon}</span>
                            <div className="text-base font-bold text-white mb-1">{opt.label}</div>
                            <div className="text-[11px] text-zinc-500 font-medium leading-tight">{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────── STEP 4: EXTRAS (Optional) ─────────────── */}
              {customizeStep === CustomizeStep.EXTRAS && (
                <div className="animate-fade-slide-in text-left">
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-bold mb-2 tracking-tight text-white">Dream Upgrades</h3>
                    <p className="text-sm text-zinc-500 mb-2">Add mods you've been dreaming about</p>
                    <span className="inline-block px-3 py-1 bg-zinc-900/80 rounded-full text-[10px] font-extrabold text-zinc-600 uppercase tracking-widest border border-white/5">Optional</span>
                  </div>
                  
                  {analysis.popularMods && analysis.popularMods.length > 0 ? (
                    <div className="space-y-6">
                      <div className="flex flex-wrap gap-2.5 justify-center">
                        {analysis.popularMods.slice(0, 6).map((mod) => {
                          const isSelected = selectedMods.includes(mod.name);
                          return (
                            <button
                              key={mod.id || mod.name}
                              onClick={() => toggleMod(mod.name)}
                              className={`px-5 py-3 rounded-2xl text-[11px] font-bold tracking-wider transition-all ${
                                isSelected
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20 scale-105'
                                  : 'bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 border border-white/5'
                              }`}
                            >
                              {isSelected && <Check size={12} className="inline mr-2" strokeWidth={4} />}
                              {mod.name.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-center text-[11px] font-medium text-zinc-600 italic">
                        {selectedMods.length > 0 
                          ? `Ready to add ${selectedMods.length} unique detail${selectedMods.length > 1 ? 's' : ''}`
                          : "Smart suggestions based on your model"}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Wand2 size={40} className="mx-auto text-zinc-800 mb-4" />
                      <p className="text-sm text-zinc-500">Scanning for compatible mods...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-4">
              {customizeStep !== CustomizeStep.ANGLE && (
                <button
                  onClick={() => {
                    haptic.light();
                    if (customizeStep === CustomizeStep.SCENE) setCustomizeStep(CustomizeStep.ANGLE);
                    else if (customizeStep === CustomizeStep.STYLE) setCustomizeStep(CustomizeStep.SCENE);
                    else if (customizeStep === CustomizeStep.EXTRAS) setCustomizeStep(CustomizeStep.STYLE);
                  }}
                  className="w-20 h-16 rounded-3xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-all active:scale-90"
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              
              <button
                onClick={() => {
                  haptic.light();
                  if (customizeStep === CustomizeStep.ANGLE) setCustomizeStep(CustomizeStep.SCENE);
                  else if (customizeStep === CustomizeStep.SCENE) setCustomizeStep(CustomizeStep.STYLE);
                  else if (customizeStep === CustomizeStep.STYLE) setCustomizeStep(CustomizeStep.EXTRAS);
                  else handleGenerate();
                }}
                className={`flex-1 h-16 rounded-3xl font-extrabold tracking-tight text-lg shadow-2xl transition-all btn-primary-press flex items-center justify-center gap-3 ${
                  customizeStep === CustomizeStep.EXTRAS
                    ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-orange-500/30'
                    : 'bg-white text-black'
                }`}
              >
                {customizeStep === CustomizeStep.EXTRAS ? (
                  <>
                    <Sparkles size={22} />
                    CREATE ART
                  </>
                ) : (
                  <>
                    NEXT
                    <ChevronRight size={22} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============ GENERATING ============ */}
        {step === Step.GENERATING && (
          <GeneratingScreen 
            imageBase64={imageBase64}
            analysis={analysis}
            statusMessage={statusMessage}
            background={background}
            position={position}
            selectedMods={selectedMods}
          />
        )}

        {/* ============ PREVIEW ============ */}
        {step === Step.PREVIEW && previewArt && !hasPaid && (
          <div className="pt-4 animate-fade-slide-in">
            
            {/* DEMO MODE: Before/After Slider */}
            {isDemoMode ? (
              <div className="space-y-6">
                {/* Title */}
                <div className="text-center mb-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4 animate-pulse">
                    <Sparkles size={12} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Generation Complete</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Your Art is Ready</h2>
                  <p className="text-sm text-zinc-500">
                    {analysis?.year} {analysis?.make} {analysis?.model}
                  </p>
                </div>
                
                {/* Before/After Slider */}
                <div className="aspect-[3/4] rounded-[2.5rem] overflow-hidden bg-zinc-950 border border-white/5 shadow-2xl">
                  {imageBase64 && previewArt ? (
                    <BeforeAfterSlider 
                      beforeImage={`data:image/jpeg;base64,${imageBase64}`}
                      afterImage={`data:image/png;base64,${previewArt}`}
                      beforeLabel="Original"
                      afterLabel="AI Masterpiece"
                      autoAnimate={true}
                    />
                  ) : previewArt ? (
                    <img 
                      src={`data:image/png;base64,${previewArt}`}
                      className="w-full h-full object-contain"
                      alt="Your artwork"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      No image data available
                    </div>
                  )}
                </div>
                
                {/* Save Button - Different text for mobile vs desktop */}
                <button 
                  onClick={async () => {
                    if (!previewArt || !analysis) return;
                    haptic.success();
                    
                    const mimeType = (window as any).__lastArtMimeType || 'image/png';
                    const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
                    const fileName = `GarageCanvas-${analysis.make}-${analysis.model}.${extension}`;
                    
                    // Check if mobile (touch device)
                    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                    
                    const byteCharacters = atob(previewArt);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: mimeType });
                    const file = new File([blob], fileName, { type: mimeType });
                    
                    // On mobile only, try native share (save to gallery)
                    if (isMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
                      try {
                        await navigator.share({
                          files: [file],
                          title: 'GarageCanvas Art',
                        });
                        return;
                      } catch (err) {
                        console.log('Share cancelled, falling back to download');
                      }
                    }
                    
                    // On desktop (or if share fails), download using blob URL
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full h-16 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white font-extrabold text-lg rounded-3xl flex items-center justify-center gap-3 shadow-2xl shadow-orange-500/30 btn-primary-press active:scale-95"
                >
                  <Download size={24} />
                  <span className="md:hidden">SAVE TO GALLERY</span>
                  <span className="hidden md:inline">SAVE PHOTO</span>
                </button>
                
                {/* Create Another */}
                <button 
                  onClick={startNew}
                  className="w-full py-4 text-zinc-600 hover:text-zinc-400 font-bold uppercase tracking-[0.2em] text-[10px] transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  Create Another
                </button>
              </div>
            ) : (
              /* NORMAL MODE: Blurred preview with paywall */
              <div className="space-y-6">
                {/* Preview Image - Blurred */}
                <div className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden bg-zinc-950 border border-white/5 shadow-2xl">
                  <img 
                    src={`data:image/png;base64,${previewArt}`}
                    className="w-full h-full object-contain blur-[12px] opacity-60 scale-105"
                    alt="Preview"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center animate-float">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-[2rem] bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-2xl">
                        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <span className="text-white font-bold tracking-[0.3em] uppercase text-[10px]">Premium Preview</span>
                    </div>
                  </div>
                </div>

                {/* Pricing Card - Liquid Glass */}
                <div className="liquid-glass rounded-[2.5rem] p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Package size={24} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-white tracking-tight">4K Masterpiece Pack</h3>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-left">Phone + Desktop + Print</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black text-white">$3.99</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    {[
                      { icon: Smartphone, label: 'Phone', ratio: '9:20' },
                      { icon: Monitor, label: 'Desktop', ratio: '16:9' },
                      { icon: Printer, label: 'Print', ratio: '4:3' },
                    ].map((fmt) => (
                      <div key={fmt.label} className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                        <fmt.icon size={20} className="mx-auto mb-2 text-amber-500" />
                        <span className="text-[9px] font-bold text-zinc-400 block uppercase tracking-tighter">{fmt.label}</span>
                        <span className="text-[10px] font-black text-white">4K</span>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={handlePurchase}
                    disabled={isProcessingPayment}
                    className="w-full h-16 bg-white text-black font-extrabold text-lg rounded-3xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed btn-press active:scale-95 active:bg-zinc-200 shadow-2xl shadow-white/10"
                  >
                    {isProcessingPayment ? (
                      <div className="w-6 h-6 border-2 border-zinc-400 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <Download size={24} />
                        UNLOCK 4K PACK
                      </>
                    )}
                  </button>
                  
                  <p className="text-center text-[10px] text-zinc-600 mt-6 font-medium">
                    Secured by Stripe • Instant Access
                  </p>
                </div>
                
                {/* DEV MODE BUTTONS */}
                {isDevMode && (
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <button 
                      onClick={() => {
                        if (!previewArt || !analysis) return;
                        const mimeType = (window as any).__lastArtMimeType || 'image/png';
                        const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
                        const link = document.createElement('a');
                        link.href = `data:${mimeType};base64,${previewArt}`;
                        link.download = `GarageCanvas-${analysis.make}-${analysis.model}-Phone.${extension}`;
                        link.click();
                      }}
                      className="w-full py-4 bg-zinc-800 text-white font-bold rounded-2xl hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                      📱 DEV: Download Phone Only
                    </button>
                    <button 
                      onClick={handleDevUnlock}
                      className="w-full py-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                    >
                      🔓 DEV: Skip Payment
                    </button>
                  </div>
                )}

                {/* Adjust Settings */}
                <button 
                  onClick={() => { setPreviewArt(null); setStep(Step.CUSTOMIZE); }}
                  className="w-full py-4 text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-[0.2em] text-[10px] transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  Adjust Settings
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============ COMPLETE ============ */}
        {step === Step.COMPLETE && hasPaid && artSet && (
          <div className="pt-4 animate-fade-slide-in">
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                <Check size={32} className="text-green-500" />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">Complete Pack Ready</h2>
              <p className="text-sm text-zinc-500">Your 4K automotive art is waiting</p>
            </div>

            {/* Success Image */}
            <div className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden mb-8 bg-zinc-950 border border-white/5 shadow-2xl">
              <img 
                src={`data:image/png;base64,${artSet.phone}`}
                className="w-full h-full object-contain"
                alt="Your artwork"
              />
              <div className="absolute top-6 right-6 bg-green-500 text-black text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                <Check size={14} strokeWidth={4} />
                UNLOCKED
              </div>
            </div>

            {/* ZIP Download - Primary */}
            <button 
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="w-full h-16 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white font-extrabold text-lg rounded-3xl flex items-center justify-center gap-3 mb-6 disabled:opacity-50 btn-primary-press active:scale-95 shadow-2xl shadow-orange-500/30"
            >
              {isDownloading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FolderArchive size={24} />
                  DOWNLOAD ALL (ZIP)
                </>
              )}
            </button>

            {/* Individual Downloads in Liquid Glass */}
            <div className="liquid-glass rounded-[2rem] p-6 mb-8">
              <p className="text-[10px] font-extrabold text-zinc-500 text-center mb-4 uppercase tracking-[0.2em]">Individual Formats</p>
              <div className="space-y-3">
                {[
                  { key: 'phone', icon: Smartphone, label: 'Phone Wallpaper', ratio: '9:20' },
                  { key: 'desktop', icon: Monitor, label: 'Desktop Background', ratio: '16:9' },
                  { key: 'print', icon: Printer, label: 'Print-Ready Art', ratio: '4:3' },
                ].map((fmt) => (
                  <button 
                    key={fmt.key}
                    onClick={() => handleDownload(fmt.key as 'phone' | 'desktop' | 'print')}
                    className="w-full h-14 bg-white/5 hover:bg-white/10 rounded-2xl transition-all flex items-center justify-between px-5 border border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <fmt.icon size={18} className="text-amber-500" />
                      <div className="text-left">
                        <span className="text-sm font-bold block">{fmt.label}</span>
                        <span className="text-[9px] text-zinc-500 font-bold">{fmt.ratio} • 4K</span>
                      </div>
                    </div>
                    <Download size={16} className="text-zinc-500" />
                  </button>
                ))}
              </div>
            </div>

            {/* New Button */}
            <button 
              onClick={startNew}
              className="w-full h-14 rounded-2xl bg-zinc-900 border border-white/5 text-zinc-500 hover:text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              Create Another Masterpiece
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
