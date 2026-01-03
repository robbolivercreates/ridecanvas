import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { 
  Upload, Download, 
  RefreshCw, Mountain, Building2, Sparkles, Car,
  Smartphone, Monitor, Trees, Sun, Layers, Zap, Check,
  ChevronDown, Package, Printer, Camera, Aperture, Plus, FolderArchive,
  Scan, ChevronLeft, ChevronRight, Paintbrush, Wand2
} from 'lucide-react';
import { 
  ArtStyle, BackgroundTheme, StanceStyle, 
  VehicleAnalysis, FidelityMode, PositionMode 
} from './types';
import { analyzeVehicle, generateArt, generateRemainingFormats, generateArtSet, fileToGenerativePart, GeneratedArtSet } from './services/geminiService';
import { redirectToCheckout, verifyPayment, checkPaymentStatus, clearPaymentParams } from './services/stripeService';

// ============ HAPTIC FEEDBACK UTILITY ============
const haptic = {
  // Light tap - for button presses
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },
  // Medium - for selections
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
  },
  // Success - for completed actions
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([20, 50, 40]);
    }
  },
  // Error - for failed actions
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50, 30, 50]);
    }
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

const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ 
  beforeImage, 
  afterImage, 
  beforeLabel = 'Before',
  afterLabel = 'After',
  autoAnimate = false
}) => {
  const [sliderPosition, setSliderPosition] = useState(autoAnimate ? 100 : 50);
  const [isDragging, setIsDragging] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-animate on mount: 100% → 50% (reveal the "After" image)
  useEffect(() => {
    if (autoAnimate && !hasAnimated) {
      // Start from 100% (showing full "Before")
      setSliderPosition(100);
      
      // After a brief pause, animate to 50%
      const timer = setTimeout(() => {
        const duration = 1500; // 1.5 seconds
        const startPosition = 100;
        const endPosition = 50;
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
      className="relative aspect-[9/16] rounded-2xl overflow-hidden cursor-ew-resize select-none touch-pan-y bg-black"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {/* After Image (full) - the generated art */}
      <img 
        src={`data:image/png;base64,${afterImage}`}
        className="absolute inset-0 w-full h-full object-contain"
        alt="After"
        draggable={false}
      />
      
      {/* Before Image (clipped) - centered with dark background */}
      <div 
        className="absolute inset-0 overflow-hidden transition-none bg-zinc-900"
        style={{ width: `${sliderPosition}%` }}
      >
        {/* Dark background container with centered image */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ width: sliderPosition > 0 ? `${100 / (sliderPosition / 100)}%` : '100%' }}
        >
          <img 
            src={`data:image/jpeg;base64,${beforeImage}`}
            className="max-w-[85%] max-h-[70%] object-contain rounded-lg shadow-2xl"
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
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing border-4 border-white/20"
          style={{ boxShadow: '0 4px 30px rgba(0,0,0,0.4), 0 0 20px rgba(255,255,255,0.3)' }}
          onMouseDown={handleMouseDown}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
        >
          <div className="flex items-center gap-0.5 text-black">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
            </svg>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
          </div>
        </div>
      </div>
      
      {/* Labels with fade-in animation */}
      <div className={`absolute top-4 left-4 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-full text-xs font-semibold text-white transition-opacity duration-500 ${sliderPosition > 10 ? 'opacity-100' : 'opacity-0'}`}>
        {beforeLabel}
      </div>
      <div className={`absolute top-4 right-4 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 backdrop-blur-md rounded-full text-xs font-bold text-black shadow-lg transition-opacity duration-500 ${sliderPosition < 90 ? 'opacity-100' : 'opacity-0'}`}>
        ✨ {afterLabel}
      </div>
      
      {/* Drag hint - only shows after animation */}
      {showHint && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 backdrop-blur-md rounded-full text-xs text-white/80 flex items-center gap-2 animate-pulse">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Drag to compare
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      )}
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
    <div className="pt-4">
      {/* Preview of original image with overlay */}
      {imageBase64 && (
        <div className="relative aspect-[16/10] rounded-2xl overflow-hidden mb-6 bg-zinc-900">
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
              <div className="w-20 h-20 rounded-full border-4 border-zinc-800/50 border-t-amber-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={24} className="text-amber-500 animate-pulse" />
              </div>
            </div>
          </div>
          
          {/* Corner brackets */}
          <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-amber-500/50" />
          <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-amber-500/50" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-amber-500/50" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-amber-500/50" />
        </div>
      )}
      
      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Creating your masterpiece</h2>
        <p className="text-sm text-zinc-500">{statusMessage || 'This usually takes 10-15 seconds'}</p>
      </div>
      
      {/* Progressive info reveal */}
      <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800/50">
        <InfoLine visible={revealStep >= 1}>
          {analysis?.year} {analysis?.make} {analysis?.model}
        </InfoLine>
        
        <InfoLine visible={revealStep >= 2}>
          {analysis?.color} • {analysis?.isOffroad ? '4×4 Off-Road' : analysis?.category}
        </InfoLine>
        
        <InfoLine visible={revealStep >= 3}>
          {getBackgroundName(background)} backdrop • {position === PositionMode.SIDE_PROFILE ? 'Side profile' : 'Original angle'}
        </InfoLine>

        {selectedMods.length > 0 && (
          <InfoLine visible={revealStep >= 3}>
            +{selectedMods.length} virtual mod{selectedMods.length > 1 ? 's' : ''}
          </InfoLine>
        )}

        {analysis?.installedAccessories && analysis.installedAccessories.length > 0 && (
          <InfoLine visible={revealStep >= 2}>
            {analysis.installedAccessories.slice(0, 2).join(' • ')}
          </InfoLine>
        )}
        
        <div className="mt-3 pt-3 border-t border-zinc-800/50">
          <InfoLine visible={revealStep >= 4} isLoading={true}>
            Rendering in 4K resolution...
          </InfoLine>
        </div>
      </div>
    </div>
  );
};

// Scene options with beautiful gradients
const SCENES = [
  { id: BackgroundTheme.SOLID, name: 'Studio', icon: Layers, gradient: 'from-zinc-800 to-zinc-900' },
  { id: BackgroundTheme.MOUNTAINS, name: 'Mountains', icon: Mountain, gradient: 'from-slate-700 via-blue-800 to-orange-400' },
  { id: BackgroundTheme.FOREST, name: 'Forest', icon: Trees, gradient: 'from-emerald-900 to-green-600' },
  { id: BackgroundTheme.DESERT, name: 'Desert', icon: Sun, gradient: 'from-amber-700 via-orange-600 to-yellow-400' },
  { id: BackgroundTheme.CITY, name: 'Urban', icon: Building2, gradient: 'from-slate-900 via-slate-700 to-cyan-800' },
  { id: BackgroundTheme.NEON, name: 'Neon', icon: Zap, gradient: 'from-purple-900 via-pink-700 to-rose-500' },
];

const App: React.FC = () => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(Step.UPLOAD);
  
  // Main visible options
  const [background, setBackground] = useState<BackgroundTheme>(BackgroundTheme.MOUNTAINS);
  const [position, setPosition] = useState<PositionMode>(PositionMode.SIDE_PROFILE); // Default: Side Profile
  
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
              (progress) => setStatusMessage(progress)
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
              (progress) => setStatusMessage(progress)
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
    if (e.target.files?.[0]) {
      haptic.medium(); // Haptic on file select
      const base64 = await fileToGenerativePart(e.target.files[0]);
      setImageBase64(base64);
      setPreviewArt(null);
      setArtSet(null);
      setHasPaid(false);
      setSelectedMods([]);
      setScanStep(0);
      setStep(Step.ANALYZING);
      
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
    }
  };

  const handleGenerate = async () => {
    if (!imageBase64 || !analysis) return;
    haptic.medium(); // Haptic on button press
    setStep(Step.GENERATING);
    setStatusMessage("Creating your artwork...");
    
    try {
      const art = await generateArt(
        imageBase64, analysis, ArtStyle.POSTER, background, 
        fidelity, position, stance, selectedMods
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
        previewArt
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
        (progress) => setStatusMessage(`DEV: ${progress}`)
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
    if (analysis?.isOffroad) {
      return [
        { id: StanceStyle.STOCK, label: 'Stock' },
        { id: StanceStyle.LIFTED, label: 'Lifted' },
        { id: StanceStyle.STEELIES, label: 'Mud Tires' },
      ];
    }
    return [
      { id: StanceStyle.STOCK, label: 'Stock' },
      { id: StanceStyle.LOWERED, label: 'Lowered' },
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
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo with Easter Egg - 5 taps to toggle demo mode */}
          <button 
            onClick={handleLogoTap}
            className={`flex items-center gap-2 transition-all duration-200 ${
              logoTapCount > 0 ? 'scale-95' : ''
            } ${logoTapCount >= 3 ? 'opacity-70' : ''}`}
          >
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center transition-all duration-300 ${
              logoTapCount >= 4 ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black' : ''
            }`}>
              <Car size={16} className="text-white" />
            </div>
            <span className="font-semibold text-sm">TheGarageCanvas</span>
          </button>
          {step !== Step.UPLOAD && (
            <button 
              onClick={startNew}
              className="text-xs text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Plus size={14} />
              New
            </button>
          )}
        </div>
      </header>
      
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
        className="pb-8 px-4 max-w-lg mx-auto"
        style={{ paddingTop: 'calc(56px + env(safe-area-inset-top, 0px))' }}
      >
        
        {/* ============ UPLOAD ============ */}
        {step === Step.UPLOAD && (
          <div className="pt-16 animate-fade-slide-in">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Upload Your Ride</h1>
              <p className="text-zinc-500 text-sm">Side views look best. Any angle works.</p>
            </div>
            
            <label className="block aspect-[4/3] rounded-3xl border-2 border-dashed border-zinc-800 hover:border-amber-500/50 transition-all cursor-pointer bg-zinc-900/30 hover:bg-zinc-900/50 flex flex-col items-center justify-center group btn-press active:scale-[0.98] active:bg-zinc-900/70">
              <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleFile} />
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 group-hover:bg-amber-500/20 group-active:bg-amber-500/30 flex items-center justify-center mb-4 transition-colors">
                <Upload size={28} className="text-zinc-500 group-hover:text-amber-500 group-active:text-amber-400 transition-colors" />
              </div>
              <span className="text-zinc-300 font-medium">Tap to upload</span>
              <span className="text-zinc-600 text-sm mt-1">JPG, PNG, HEIC</span>
            </label>
          </div>
        )}

        {/* ============ ANALYZING (with scan animation) ============ */}
        {step === Step.ANALYZING && imageBase64 && (
          <div className="pt-4">
            {/* Image with scan overlay */}
            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden mb-4 border-2 border-amber-500/30 animate-pulse-border scanner-corners scanner-corners-bottom">
              <img 
                src={`data:image/jpeg;base64,${imageBase64}`}
                className="w-full h-full object-cover"
                alt="Your vehicle"
              />
              
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/40" />
              
              {/* Scan line */}
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-b from-transparent via-amber-500/80 to-transparent animate-scan" style={{ top: '0%' }}>
                <div className="absolute inset-x-0 h-20 bg-gradient-to-b from-amber-500/20 to-transparent" />
              </div>
              
              {/* Scanning indicator */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <Scan size={14} className="text-amber-500 animate-pulse" />
                <span className="text-xs font-medium text-white/80">Scanning...</span>
              </div>
              
              {/* Progressive info reveals */}
              <div className="absolute bottom-3 left-3 right-3 space-y-2">
                {analysis && (
                  <>
                    <InfoPill visible={scanStep >= 1} delay={0}>
                      {analysis.make} {analysis.model}
                    </InfoPill>
                    <InfoPill visible={scanStep >= 2} delay={100}>
                      {analysis.year} • {analysis.color}
                    </InfoPill>
                    <InfoPill visible={scanStep >= 3} delay={200}>
                      {analysis.isOffroad ? '4×4 Off-Road' : analysis.category}
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
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
                <p className="text-zinc-500 text-sm">Analyzing your ride...</p>
              </div>
            )}
          </div>
        )}

        {/* ============ CUSTOMIZE WITH STEPPERS ============ */}
        {step === Step.CUSTOMIZE && analysis && (
          <div className="pt-2 animate-fade-slide-in">
            
            {/* ═══════════════ VEHICLE PREVIEW (Always visible at top) ═══════════════ */}
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-4 bg-zinc-900">
              <img 
                src={`data:image/jpeg;base64,${imageBase64}`}
                className="w-full h-full object-cover"
                alt="Your vehicle"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-semibold">{analysis.year} {analysis.make} {analysis.model}</span>
                  {analysis.isOffroad && (
                    <span className="text-[10px] bg-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full font-medium">4×4</span>
                  )}
                </div>
              </div>
            </div>

            {/* ═══════════════ STEPPER PROGRESS BAR ═══════════════ */}
            <div className="mb-5">
              {/* Progress dots */}
              <div className="flex items-center justify-center gap-2 mb-3">
                {[
                  { step: CustomizeStep.ANGLE, label: 'Angle', icon: Aperture },
                  { step: CustomizeStep.SCENE, label: 'Scene', icon: Mountain },
                  { step: CustomizeStep.STYLE, label: 'Style', icon: Paintbrush },
                  { step: CustomizeStep.EXTRAS, label: 'Extras', icon: Wand2 },
                ].map((item, index) => {
                  const isActive = customizeStep === item.step;
                  const isCompleted = customizeStep > item.step;
                  const Icon = item.icon;
                  return (
                    <React.Fragment key={item.step}>
                      <button
                        onClick={() => setCustomizeStep(item.step)}
                        className={`flex flex-col items-center transition-all ${
                          isActive ? 'scale-110' : 'opacity-50 hover:opacity-80'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-all ${
                          isActive 
                            ? 'bg-amber-500 text-black' 
                            : isCompleted 
                              ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50' 
                              : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {isCompleted ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
                        </div>
                        <span className={`text-[9px] font-medium ${
                          isActive ? 'text-amber-500' : isCompleted ? 'text-green-400' : 'text-zinc-600'
                        }`}>
                          {item.label}
                        </span>
                      </button>
                      {index < 3 && (
                        <div className={`w-6 h-0.5 rounded-full mt-[-12px] ${
                          customizeStep > item.step ? 'bg-green-500/50' : 'bg-zinc-800'
                        }`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              
              {/* Step indicator text */}
              <p className="text-center text-[11px] text-zinc-600">
                Step {customizeStep} of 4
                {customizeStep === CustomizeStep.EXTRAS && <span className="text-zinc-700"> • optional</span>}
              </p>
            </div>

            {/* ═══════════════ STEP CONTENT ═══════════════ */}
            <div className="min-h-[200px]">
              
              {/* ─────────────── STEP 1: ANGLE ─────────────── */}
              {customizeStep === CustomizeStep.ANGLE && (
                <div className="animate-fade-slide-in">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1">Choose the Angle</h3>
                    <p className="text-xs text-zinc-500">How should your car be shown?</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => setPosition(PositionMode.SIDE_PROFILE)}
                      className={`relative p-4 rounded-2xl transition-all text-left flex items-center gap-4 ${
                        position === PositionMode.SIDE_PROFILE
                          ? 'bg-zinc-800 ring-2 ring-amber-500'
                          : 'bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        position === PositionMode.SIDE_PROFILE ? 'bg-amber-500/20' : 'bg-zinc-800'
                      }`}>
                        <Aperture size={24} className={position === PositionMode.SIDE_PROFILE ? 'text-amber-500' : 'text-zinc-500'} />
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-base block mb-0.5">Side Profile</span>
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
                      className={`relative p-4 rounded-2xl transition-all text-left flex items-center gap-4 ${
                        position === PositionMode.AS_PHOTOGRAPHED
                          ? 'bg-zinc-800 ring-2 ring-amber-500'
                          : 'bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        position === PositionMode.AS_PHOTOGRAPHED ? 'bg-amber-500/20' : 'bg-zinc-800'
                      }`}>
                        <Camera size={24} className={position === PositionMode.AS_PHOTOGRAPHED ? 'text-amber-500' : 'text-zinc-500'} />
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-base block mb-0.5">As Photographed</span>
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
                <div className="animate-fade-slide-in">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1">Pick a Scene</h3>
                    <p className="text-xs text-zinc-500">Where should your car be?</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {SCENES.map((scene) => {
                      const isSelected = background === scene.id;
                      const Icon = scene.icon;
                      return (
                        <button
                          key={scene.id}
                          onClick={() => setBackground(scene.id)}
                          className={`relative aspect-square rounded-xl overflow-hidden transition-all ${
                            isSelected 
                              ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-black scale-[1.02]' 
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${scene.gradient}`} />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Icon size={22} className="text-white/90 mb-1" />
                            <span className="text-[10px] font-medium text-white/90 text-center px-1">{scene.name}</span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                              <Check size={12} className="text-black" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─────────────── STEP 3: STYLE ─────────────── */}
              {customizeStep === CustomizeStep.STYLE && (
                <div className="animate-fade-slide-in">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1">Set the Style</h3>
                    <p className="text-xs text-zinc-500">How clean or detailed?</p>
                  </div>
                  
                  {/* Condition */}
                  <div className="mb-5">
                    <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Condition</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: FidelityMode.EXACT_MATCH, label: 'As-is', desc: 'Every scratch, every story', emoji: '🛤️' },
                        { id: FidelityMode.CLEAN_BUILD, label: 'Clean', desc: 'Fresh from the detailer', emoji: '✨' },
                        { id: FidelityMode.FACTORY_FRESH, label: 'Stock', desc: 'Showroom new', emoji: '🏭' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setFidelity(opt.id)}
                          className={`p-3 rounded-xl text-center transition-all ${
                            fidelity === opt.id
                              ? 'bg-zinc-800 ring-2 ring-amber-500'
                              : 'bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800'
                          }`}
                        >
                          <span className="text-lg mb-1 block">{opt.emoji}</span>
                          <div className="text-sm font-semibold">{opt.label}</div>
                          <div className="text-[9px] text-zinc-500 mt-0.5 leading-tight">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stance */}
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Stance</label>
                    <div className="grid grid-cols-2 gap-2">
                      {getStanceOptions().map((opt) => {
                        const stanceEmojis: Record<string, string> = {
                          'Stock': '📍',
                          'Lifted + AT': '⬆️',
                          'Steelies + Mud': '🔩',
                          'Lowered + Wheels': '⬇️',
                        };
                        const stanceDescs: Record<string, string> = {
                          'Stock': 'As it sits now',
                          'Lifted + AT': 'Ready for trails',
                          'Steelies + Mud': 'Built for mud',
                          'Lowered + Wheels': 'Street stance',
                        };
                        return (
                          <button
                            key={opt.id}
                            onClick={() => setStance(opt.id)}
                            className={`p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                              stance === opt.id
                                ? 'bg-zinc-800 ring-2 ring-amber-500'
                                : 'bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800'
                            }`}
                          >
                            <span className="text-lg">{stanceEmojis[opt.label] || '📍'}</span>
                            <div>
                              <div className="text-sm font-semibold">{opt.label}</div>
                              <div className="text-[9px] text-zinc-500">{stanceDescs[opt.label] || ''}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────── STEP 4: EXTRAS (Optional) ─────────────── */}
              {customizeStep === CustomizeStep.EXTRAS && (
                <div className="animate-fade-slide-in">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1">Dream Upgrades</h3>
                    <p className="text-xs text-zinc-500">Add mods you've been dreaming about</p>
                    <span className="inline-block mt-1 text-[10px] text-zinc-700 bg-zinc-900 px-2 py-0.5 rounded-full">Optional</span>
                  </div>
                  
                  {analysis.popularMods && analysis.popularMods.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {analysis.popularMods.slice(0, 6).map((mod) => {
                          const isSelected = selectedMods.includes(mod.name);
                          return (
                            <button
                              key={mod.id || mod.name}
                              onClick={() => toggleMod(mod.name)}
                              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                isSelected
                                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                              }`}
                            >
                              {isSelected && <span className="mr-1.5">✓</span>}
                              {mod.name}
                            </button>
                          );
                        })}
                      </div>
                      {selectedMods.length > 0 && (
                        <p className="text-center text-xs text-amber-500 mt-4">
                          +{selectedMods.length} upgrade{selectedMods.length > 1 ? 's' : ''} will be added to your art
                        </p>
                      )}
                      {selectedMods.length === 0 && (
                        <p className="text-center text-xs text-zinc-600 mt-4">
                          Tap any mod to add it, or skip to create art
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <Wand2 size={32} className="mx-auto text-zinc-700 mb-2" />
                      <p className="text-sm text-zinc-500">No popular mods found for this vehicle</p>
                      <p className="text-xs text-zinc-600 mt-1">You can still create amazing art!</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ═══════════════ NAVIGATION BUTTONS ═══════════════ */}
            <div className="mt-6 space-y-3">
              {customizeStep < CustomizeStep.EXTRAS ? (
                <button 
                  onClick={() => setCustomizeStep(customizeStep + 1)}
                  className="w-full py-4 bg-white text-black font-semibold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              ) : (
                <button 
                  onClick={handleGenerate}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 btn-primary-press active:scale-95"
                >
                  <Sparkles size={20} />
                  Create Art
                </button>
              )}
              
              {/* Back button or Skip */}
              <div className="flex gap-3">
                {customizeStep > CustomizeStep.ANGLE && (
                  <button 
                    onClick={() => setCustomizeStep(customizeStep - 1)}
                    className="flex-1 py-3 text-zinc-500 hover:text-white font-medium rounded-xl flex items-center justify-center gap-1 transition-colors"
                  >
                    <ChevronLeft size={16} />
                    Back
                  </button>
                )}
                {customizeStep < CustomizeStep.EXTRAS && (
                  <button 
                    onClick={handleGenerate}
                    className="flex-1 py-3 text-zinc-600 hover:text-zinc-400 text-sm font-medium rounded-xl flex items-center justify-center gap-1 transition-colors"
                  >
                    Skip to Create
                    <Sparkles size={14} />
                  </button>
                )}
              </div>
              
              {/* Price hint - hide in demo mode */}
              {!isDemoMode && customizeStep === CustomizeStep.EXTRAS && (
                <p className="text-center text-[11px] text-zinc-600">Free preview. $3.99 for 4K pack.</p>
              )}
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
              <>
                {/* Title */}
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-white">✨ Your art is ready</h2>
                  <p className="text-sm text-zinc-500">
                    {analysis?.year} {analysis?.make} {analysis?.model}
                  </p>
                </div>
                
                {/* Before/After Slider with auto-animation (or just art if no original) */}
                <div className="mb-5">
                  {imageBase64 ? (
                    <BeforeAfterSlider 
                      beforeImage={imageBase64}
                      afterImage={previewArt}
                      beforeLabel="Original"
                      afterLabel="Art"
                      autoAnimate={true}
                    />
                  ) : (
                    <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black">
                      <img 
                        src={`data:image/png;base64,${previewArt}`}
                        className="w-full h-full object-contain"
                        alt="Your artwork"
                      />
                    </div>
                  )}
                </div>
                
                {/* Save to Gallery Button (Demo Mode - uses Web Share API for iOS) */}
                <button 
                  onClick={async () => {
                    if (!previewArt || !analysis) return;
                    
                    // Get correct mimeType
                    const mimeType = (window as any).__lastArtMimeType || 'image/png';
                    const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
                    const fileName = `GarageCanvas-${analysis.make}-${analysis.model}.${extension}`;
                    
                    // Convert base64 to blob
                    const byteCharacters = atob(previewArt);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: mimeType });
                    const file = new File([blob], fileName, { type: mimeType });
                    
                    // Try Web Share API first (iOS can save to gallery from here)
                    if (navigator.share && navigator.canShare?.({ files: [file] })) {
                      try {
                        await navigator.share({
                          files: [file],
                          title: 'GarageCanvas Art',
                        });
                        return;
                      } catch (err) {
                        // User cancelled or share failed, fall back to download
                        console.log('Share cancelled, falling back to download');
                      }
                    }
                    
                    // Fallback: regular download
                    const link = document.createElement('a');
                    link.href = `data:${mimeType};base64,${previewArt}`;
                    link.download = fileName;
                    link.click();
                  }}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 btn-primary-press active:scale-95"
                >
                  <Download size={20} />
                  Save to Gallery
                </button>
                
                {/* Create Another */}
                <button 
                  onClick={startNew}
                  className="w-full py-3 mt-3 text-zinc-500 hover:text-white transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  Create Another
                </button>
              </>
            ) : (
              /* NORMAL MODE: Blurred preview with paywall */
              <>
                {/* Preview Image - Blurred */}
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden mb-5 bg-zinc-900">
                  <img 
                    src={`data:image/png;base64,${previewArt}`}
                    className="w-full h-full object-contain blur-[5px] opacity-80"
                    alt="Preview"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-black/40 backdrop-blur flex items-center justify-center border border-white/10">
                        <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <p className="text-white/60 text-sm font-medium">Preview</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Card */}
                <div className="bg-zinc-900 rounded-2xl p-5 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <Package size={20} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">4K Premium Pack</h3>
                        <p className="text-xs text-zinc-500">All 3 formats in ZIP</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-white">$3.99</span>
                  </div>
                  
                  <div className="flex gap-2 mb-5">
                    {[
                      { icon: Smartphone, label: 'Phone', ratio: '9:16' },
                      { icon: Monitor, label: 'Desktop', ratio: '16:9' },
                      { icon: Printer, label: 'Print', ratio: '4:3' },
                    ].map((fmt) => (
                      <div key={fmt.label} className="flex-1 bg-zinc-800 rounded-xl p-2.5 text-center">
                        <fmt.icon size={16} className="mx-auto mb-1 text-zinc-500" />
                        <span className="text-[10px] text-zinc-400 block">{fmt.label}</span>
                        <span className="text-[9px] text-amber-500 font-medium">4K</span>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={handlePurchase}
                    disabled={isProcessingPayment}
                    className="w-full py-4 bg-white text-black font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed btn-press active:scale-95 active:bg-zinc-200"
                  >
                    {isProcessingPayment ? (
                      <div className="w-5 h-5 border-2 border-zinc-300 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <Download size={18} />
                        Unlock Downloads
                      </>
                    )}
                  </button>
                  
                  {/* DEV MODE BUTTONS */}
                  {isDevMode && (
                    <div className="space-y-2 mt-2">
                  <button 
                    onClick={() => {
                      if (!previewArt || !analysis) return;
                      // Get correct mimeType (stored during generation)
                      const mimeType = (window as any).__lastArtMimeType || 'image/png';
                      const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
                      const link = document.createElement('a');
                      link.href = `data:${mimeType};base64,${previewArt}`;
                      link.download = `GarageCanvas-${analysis.make}-${analysis.model}-Phone.${extension}`;
                      link.click();
                    }}
                    className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    📱 DEV: Download Phone Only
                  </button>
                      <button 
                        onClick={handleDevUnlock}
                        disabled={isProcessingPayment}
                        className="w-full py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        🔓 DEV: Generate All Formats
                      </button>
                    </div>
                  )}
                </div>

                {/* Adjust Button */}
                <button 
                  onClick={() => { setPreviewArt(null); setStep(Step.CUSTOMIZE); }}
                  className="w-full py-3 text-zinc-500 hover:text-white transition-colors text-sm"
                >
                  ← Try different settings
                </button>
              </>
            )}
          </div>
        )}

        {/* ============ COMPLETE ============ */}
        {step === Step.COMPLETE && hasPaid && artSet && (
          <div className="pt-4 animate-fade-slide-in">
            {/* Success Image */}
            <div className="relative aspect-[9/16] rounded-2xl overflow-hidden mb-5 bg-zinc-900">
              <img 
                src={`data:image/png;base64,${artSet.phone}`}
                className="w-full h-full object-contain"
                alt="Your artwork"
              />
              <div className="absolute top-3 right-3 bg-green-500 text-black text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <Check size={12} />
                UNLOCKED
              </div>
            </div>

            {/* ZIP Download - Primary */}
            <button 
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl flex items-center justify-center gap-3 mb-4 disabled:opacity-50 btn-primary-press active:scale-95"
            >
              {isDownloading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FolderArchive size={20} />
                  Download All (ZIP)
                </>
              )}
            </button>

            {/* Individual Downloads */}
            <div className="space-y-2 mb-5">
              <p className="text-xs text-zinc-600 text-center mb-2">or download individually</p>
              {[
                { key: 'phone', icon: Smartphone, label: 'Phone', ratio: '9:16' },
                { key: 'desktop', icon: Monitor, label: 'Desktop', ratio: '16:9' },
                { key: 'print', icon: Printer, label: 'Print', ratio: '4:3' },
              ].map((fmt) => (
                <button 
                  key={fmt.key}
                  onClick={() => handleDownload(fmt.key as 'phone' | 'desktop' | 'print')}
                  className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors flex items-center justify-between px-4"
                >
                  <div className="flex items-center gap-3">
                    <fmt.icon size={16} className="text-zinc-500" />
                    <span className="text-sm">{fmt.label}</span>
                    <span className="text-[9px] text-zinc-600">{fmt.ratio}</span>
                  </div>
                  <Download size={14} className="text-zinc-600" />
                </button>
              ))}
            </div>

            {/* New Button */}
            <button 
              onClick={startNew}
              className="w-full py-3 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors flex items-center justify-center gap-2 text-zinc-500 hover:text-white"
            >
              <RefreshCw size={16} />
              Create Another
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
