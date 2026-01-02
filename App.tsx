import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Image as ImageIcon, Download, ArrowRight, 
  RefreshCw, Mountain, Building2, Palette, Sparkles, Car,
  Smartphone, Monitor, Disc, ArrowUp,
  Cog, Trees, Sun, Plus, Layers, Zap, Check, Wrench, Camera, Factory,
  ScanLine, Move, ChevronDown, Sliders, Package, Star, Printer
} from 'lucide-react';
import { 
  ArtStyle, BackgroundTheme, StanceStyle, 
  VehicleAnalysis, FidelityMode, PositionMode 
} from './types';
import { analyzeVehicle, generateArt, generateArtSet, fileToGenerativePart, GeneratedArtSet } from './services/geminiService';
import { redirectToCheckout, verifyPayment, checkPaymentStatus, clearPaymentParams } from './services/stripeService';

enum Step {
  UPLOAD = 1,
  ANALYZING = 2,
  CUSTOMIZE = 3,
  GENERATING_PREVIEW = 4,
  PREVIEW = 5,
  COMPLETE = 6,
}

const STEP_LABELS = ['Upload', 'Customize', 'Preview', 'Download'];


const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(Step.UPLOAD);
  
  // Art Settings
  const [style] = useState<ArtStyle>(ArtStyle.POSTER);
  const [background, setBackground] = useState<BackgroundTheme>(BackgroundTheme.SOLID);
  const [fidelity, setFidelity] = useState<FidelityMode>(FidelityMode.EXACT_MATCH);
  const [position, setPosition] = useState<PositionMode>(PositionMode.AS_PHOTOGRAPHED);
  const [stance, setStance] = useState<StanceStyle>(StanceStyle.STOCK);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [showAddOns, setShowAddOns] = useState(false);
  
  // Data
  const [analysis, setAnalysis] = useState<VehicleAnalysis | null>(null);
  const [previewArt, setPreviewArt] = useState<string | null>(null); // Phone preview (9:16)
  const [artSet, setArtSet] = useState<GeneratedArtSet | null>(null); // Full set after payment
  const [statusMessage, setStatusMessage] = useState("");
  
  // Payment
  const [hasPaid, setHasPaid] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Load API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setHasApiKey(true);
    }
  }, []);

  // Check for payment return from Stripe
  useEffect(() => {
    const { sessionId, cancelled, artSessionId } = checkPaymentStatus();
    
    if (sessionId) {
      // User returned from Stripe - verify payment
      handlePaymentReturn(sessionId);
    } else if (cancelled) {
      // User cancelled payment
      clearPaymentParams();
      alert('Payment was cancelled. You can try again when ready.');
    }
  }, []);

  const handlePaymentReturn = async (sessionId: string) => {
    setIsProcessingPayment(true);
    setStatusMessage("Verifying payment...");
    
    try {
      const result = await verifyPayment(sessionId);
      clearPaymentParams();
      
      if (result.success) {
        // Payment successful! Load saved state and generate art
        const savedState = localStorage.getItem('ridecanvas_pending_art');
        if (savedState) {
          const state = JSON.parse(savedState);
          // Restore state
          setImageBase64(state.imageBase64);
          setAnalysis(state.analysis);
          setBackground(state.background);
          setFidelity(state.fidelity);
          setPosition(state.position);
          setStance(state.stance);
          setSelectedMods(state.selectedMods || []);
          
          // Generate the full art set
          setStep(Step.GENERATING_PREVIEW);
          setStatusMessage("Creating your 4K masterpieces...");
          
          const set = await generateArtSet(
            state.imageBase64, 
            state.analysis, 
            ArtStyle.POSTER, 
            state.background, 
            state.fidelity, 
            state.position,
            state.stance, 
            state.selectedMods || [], 
            apiKey || localStorage.getItem('gemini_api_key') || '',
            (progress) => setStatusMessage(progress)
          );
          
          setArtSet(set);
          setHasPaid(true);
          setStep(Step.COMPLETE);
          localStorage.removeItem('ridecanvas_pending_art');
        }
      } else {
        alert('Payment verification failed. Please contact support.');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      alert('Error verifying payment. Please contact support.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Apply AI suggestions when analysis completes
  useEffect(() => {
    if (analysis) {
      if (analysis.suggestedBackground) {
        const bgMap: Record<string, BackgroundTheme> = {
          'Studio Clean': BackgroundTheme.SOLID,
          'Mountain Peaks': BackgroundTheme.MOUNTAINS,
          'Nordic Forest': BackgroundTheme.FOREST,
          'Desert Dunes': BackgroundTheme.DESERT,
          'City Skyline': BackgroundTheme.CITY,
          'Neon Night': BackgroundTheme.NEON,
          'Studio Garage': BackgroundTheme.GARAGE,
        };
        setBackground(bgMap[analysis.suggestedBackground as string] || BackgroundTheme.SOLID);
      }
      setStance(StanceStyle.STOCK);
      setSelectedMods([]);
      setShowAddOns(false);
    }
  }, [analysis]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const base64 = await fileToGenerativePart(e.target.files[0]);
      setImageBase64(base64);
      setPreviewArt(null);
      setArtSet(null);
      setHasPaid(false);
      setStep(Step.ANALYZING);
      setStatusMessage("Identifying your ride...");
      try {
        const res = await analyzeVehicle(base64, apiKey);
        setAnalysis(res);
        setStep(Step.CUSTOMIZE);
      } catch {
        setStep(Step.UPLOAD);
        alert("Couldn't analyze that image. Try a clearer side-profile shot.");
      }
    }
  };

  const handleGeneratePreview = async () => {
    if (!imageBase64 || !analysis) return;
    setStep(Step.GENERATING_PREVIEW);
    setStatusMessage("Creating preview...");
    try {
      // Generate just the phone version for preview (free)
      const art = await generateArt(
        imageBase64, analysis, style, background, fidelity, position,
        stance, selectedMods, apiKey
      );
      setPreviewArt(art);
      setStep(Step.PREVIEW);
    } catch {
      setStep(Step.CUSTOMIZE);
      alert("Generation failed. Please try again.");
    }
  };

  const handlePurchase = async () => {
    if (!imageBase64 || !analysis) return;
    
    setIsProcessingPayment(true);
    setStatusMessage("Redirecting to payment...");
    
    try {
      // Save current state to localStorage (will be restored after payment)
      const stateToSave = {
        imageBase64,
        analysis,
        background,
        fidelity,
        position,
        stance,
        selectedMods,
      };
      localStorage.setItem('ridecanvas_pending_art', JSON.stringify(stateToSave));
      
      // Create unique session ID
      const artSessionId = `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Redirect to Stripe Checkout
      await redirectToCheckout(
        artSessionId,
        `${analysis.year} ${analysis.make} ${analysis.model}`
      );
    } catch (error) {
      console.error('Checkout error:', error);
      setIsProcessingPayment(false);
      alert("Failed to start checkout. Please try again.");
    }
  };

  const handleDownload = (format: 'phone' | 'desktop' | 'print') => {
    if (!artSet || !analysis) return;
    
    const images = {
      phone: artSet.phone,
      desktop: artSet.desktop,
      print: artSet.print,
    };
    
    const formatLabels = {
      phone: 'Phone-9x16',
      desktop: 'Desktop-16x9', 
      print: 'Print-4x3',
    };
    
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${images[format]}`;
    link.download = `RideCanvas-${analysis.make}-${analysis.model}-${formatLabels[format]}.png`;
    link.click();
  };

  const handleAdjust = () => {
    setStep(Step.CUSTOMIZE);
    setPreviewArt(null);
    setArtSet(null);
    setHasPaid(false);
  };

  const startNew = () => {
    setImageBase64(null);
    setPreviewArt(null);
    setArtSet(null);
    setAnalysis(null);
    setSelectedMods([]);
    setShowAddOns(false);
    setHasPaid(false);
    setStep(Step.UPLOAD);
  };

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setHasApiKey(true);
    }
  };

  const toggleMod = (modName: string) => {
    setSelectedMods(prev => 
      prev.includes(modName) 
        ? prev.filter(m => m !== modName)
        : [...prev, modName]
    );
  };

  const getStepIndex = () => {
    if (step === Step.UPLOAD) return 0;
    if (step === Step.ANALYZING || step === Step.CUSTOMIZE) return 1;
    if (step === Step.GENERATING_PREVIEW || step === Step.PREVIEW) return 2;
    if (step === Step.COMPLETE) return 3;
    return 0;
  };

  const getStanceOptions = () => {
    if (!analysis) return [];
    
    const keepCurrent = { 
      id: StanceStyle.STOCK, 
      label: 'Keep Current', 
      icon: Disc, 
      desc: 'No changes' 
    };
    
    if (analysis.isOffroad) {
      return [
        keepCurrent,
        { id: StanceStyle.LIFTED, label: 'Off-Road', icon: ArrowUp, desc: 'Lifted + AT' },
        { id: StanceStyle.STEELIES, label: 'Expedition', icon: Cog, desc: 'Steelies + Mud' },
      ];
    }
    
    const wheelInfo = analysis.popularWheels && analysis.popularWheels.length > 0
      ? analysis.popularWheels[0].name.split(' ')[0]
      : 'New wheels';
    
    return [
      keepCurrent,
      { id: StanceStyle.LOWERED, label: 'Street', icon: Disc, desc: `Lowered + ${wheelInfo}` },
    ];
  };

  // ============ API KEY SCREEN ============
  if (!hasApiKey) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="liquid-glass relative max-w-sm w-full p-10 rounded-[2.5rem] text-center specular-edge">
        <div className="w-16 h-16 liquid-glass-subtle rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Car className="text-accent" size={28} />
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">RideCanvas</h1>
        <p className="text-zinc-500 text-sm mb-8">Turn your ride into wall-worthy art</p>
        <form onSubmit={handleApiKeySubmit} className="space-y-4">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste Gemini API Key"
            className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all font-mono text-sm"
            autoFocus
          />
          <button 
            type="submit"
            disabled={!apiKey.trim()}
            className="w-full bg-accent text-black font-semibold py-4 rounded-2xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed pill-btn"
          >
            Get Started
          </button>
        </form>
      </div>
    </div>
  );

  // ============ MAIN APP ============
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center py-8 px-5">
      
      {/* Header */}
      <header className="w-full max-w-lg flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 liquid-glass-subtle rounded-xl flex items-center justify-center">
            <Car className="text-accent" size={20} />
          </div>
          <span className="font-semibold text-sm tracking-tight">RideCanvas</span>
        </div>
        {step !== Step.UPLOAD && (
          <button onClick={startNew} className="liquid-glass-subtle px-4 py-2 rounded-full text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-2">
            <Plus size={14} />
            New
          </button>
        )}
      </header>

      {/* Stepper */}
      <nav className="w-full max-w-lg mb-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-4 left-0 right-0 h-[2px] bg-white/5 mx-8" />
          <div 
            className="absolute top-4 left-0 h-[2px] bg-accent mx-8 transition-all duration-500"
            style={{ width: `calc(${(getStepIndex() / 3) * 100}% - 4rem)` }}
          />
          
          {STEP_LABELS.map((label, idx) => {
            const isActive = getStepIndex() === idx;
            const isComplete = getStepIndex() > idx;
            
            return (
              <div key={label} className="relative z-10 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isComplete ? 'bg-accent text-black' :
                  isActive ? 'bg-accent text-black scale-110 shadow-lg shadow-accent/30' :
                  'bg-zinc-900 text-zinc-600 border border-white/10'
                }`}>
                  {isComplete ? <Check size={14} strokeWidth={3} /> : idx + 1}
                </div>
                <span className={`mt-2 text-[10px] font-medium uppercase tracking-wide transition-all ${
                  isActive ? 'text-accent' : isComplete ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Canvas Preview */}
      <section className="w-full max-w-lg mb-6">
        <div className="liquid-glass rounded-[2rem] aspect-[9/16] relative overflow-hidden flex items-center justify-center specular-edge">
          {!imageBase64 ? (
            <div className="flex flex-col items-center gap-4 opacity-30">
              <ImageIcon size={48} strokeWidth={1} />
              <p className="text-xs font-medium">No image yet</p>
            </div>
          ) : step === Step.PREVIEW || step === Step.COMPLETE ? (
            <>
              {hasPaid && artSet ? (
                /* Full HD image after payment - show phone version */
                <img 
                  src={`data:image/png;base64,${artSet.phone}`}
                  className="max-h-full w-full object-contain"
                  alt="Your Art"
                />
              ) : previewArt ? (
                /* Protected Preview - Large but blurred */
                <div className="relative flex items-center justify-center w-full h-full">
                  <div className="relative w-full h-full">
                    <img 
                      src={`data:image/png;base64,${previewArt}`}
                      className="w-full h-full rounded-2xl object-contain blur-[4px]"
                      alt="Preview"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 rounded-2xl" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center border border-white/10">
                      <svg className="w-7 h-7 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : null}
              {!hasPaid && previewArt && (
                <div className="absolute bottom-4 left-4 right-4 text-center">
                  <p className="text-xs text-white font-medium">Unlock all formats</p>
                </div>
              )}
            </>
          ) : (
            <>
              <img 
                src={`data:image/jpeg;base64,${imageBase64}`} 
                className="max-h-full w-full object-contain"
                alt="Vehicle"
              />
              {(step === Step.ANALYZING || step === Step.GENERATING_PREVIEW) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
                    <p className="text-xs font-medium text-zinc-400">{statusMessage}</p>
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Detection Badge */}
          {analysis && step >= Step.CUSTOMIZE && step < Step.PREVIEW && (
            <div className="absolute top-4 left-4 liquid-glass-subtle px-4 py-2 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[11px] font-medium">{analysis.year} {analysis.make} {analysis.model}</span>
              {analysis.isOffroad && <span className="text-[10px] text-accent font-medium ml-1">4×4</span>}
            </div>
          )}
        </div>
      </section>

      {/* Controls */}
      <main className="w-full max-w-lg">
        
        {/* UPLOAD STATE */}
        {step === Step.UPLOAD && (
          <label className="liquid-glass flex flex-col items-center justify-center p-12 rounded-[2rem] cursor-pointer hover:bg-white/[0.06] transition-all group specular-edge relative">
            <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleFile} />
            <div className="w-16 h-16 liquid-glass-subtle rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <Upload size={28} className="text-zinc-400 group-hover:text-accent transition-colors" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Drop your ride here</h2>
            <p className="text-zinc-500 text-sm mb-6 text-center">Side profile works best for detail accuracy</p>
            <div className="px-6 py-3 liquid-glass-subtle rounded-full text-sm font-medium group-hover:bg-accent group-hover:text-black transition-all">
              Choose Photo
            </div>
          </label>
        )}

        {/* CUSTOMIZE STATE */}
        {step === Step.CUSTOMIZE && analysis && (
          <div className="space-y-4">
            
            {/* 1. POSITION */}
            <Section number={1} title="Position" icon={Move}>
              <div className="grid grid-cols-2 gap-2">
                <OptionButton
                  selected={position === PositionMode.AS_PHOTOGRAPHED}
                  onClick={() => setPosition(PositionMode.AS_PHOTOGRAPHED)}
                  icon={Camera}
                  label="Keep Angle"
                  subtitle="As in photo"
                />
                <OptionButton
                  selected={position === PositionMode.SIDE_PROFILE}
                  onClick={() => setPosition(PositionMode.SIDE_PROFILE)}
                  icon={ScanLine}
                  label="Side View"
                  subtitle="90° profile"
                />
              </div>
            </Section>

            {/* 2. CONDITION */}
            <Section number={2} title="Condition" icon={Sparkles}>
              <div className="grid grid-cols-3 gap-2">
                <OptionButton
                  selected={fidelity === FidelityMode.EXACT_MATCH}
                  onClick={() => setFidelity(FidelityMode.EXACT_MATCH)}
                  icon={Camera}
                  label="As-Is"
                  subtitle="Dirt & all"
                />
                <OptionButton
                  selected={fidelity === FidelityMode.CLEAN_BUILD}
                  onClick={() => setFidelity(FidelityMode.CLEAN_BUILD)}
                  icon={Sparkles}
                  label="Detailed"
                  subtitle="Fresh wash"
                />
                <OptionButton
                  selected={fidelity === FidelityMode.FACTORY_FRESH}
                  onClick={() => setFidelity(FidelityMode.FACTORY_FRESH)}
                  icon={Factory}
                  label="Factory"
                  subtitle="No mods"
                />
              </div>
            </Section>

            {/* 3. STANCE */}
            <Section number={3} title="Stance" icon={Disc}>
              <div className={`grid gap-2 ${getStanceOptions().length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {getStanceOptions().map(opt => (
                  <OptionButton 
                    key={opt.id}
                    selected={stance === opt.id}
                    onClick={() => setStance(opt.id)}
                    icon={opt.icon}
                    label={opt.label}
                    subtitle={opt.desc}
                  />
                ))}
              </div>
              {stance === StanceStyle.LOWERED && analysis.popularWheels && analysis.popularWheels.length > 0 && (
                <p className="text-[10px] text-zinc-500 mt-2">
                  → {analysis.popularWheels[0].name} ({analysis.popularWheels[0].style})
                </p>
              )}
            </Section>

            {/* 4. SCENE */}
            <Section number={4} title="Scene" icon={Palette}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: BackgroundTheme.SOLID, label: 'Clean', icon: Layers },
                  { id: BackgroundTheme.MOUNTAINS, label: 'Peaks', icon: Mountain },
                  { id: BackgroundTheme.FOREST, label: 'Forest', icon: Trees },
                  { id: BackgroundTheme.DESERT, label: 'Desert', icon: Sun },
                  { id: BackgroundTheme.CITY, label: 'City', icon: Building2 },
                  { id: BackgroundTheme.NEON, label: 'Neon', icon: Zap },
                ].map(opt => (
                  <OptionButton 
                    key={opt.id} 
                    selected={background === opt.id}
                    onClick={() => setBackground(opt.id)}
                    icon={opt.icon}
                    label={opt.label}
                  />
                ))}
              </div>
            </Section>

            {/* ADD-ONS (Optional) */}
            {analysis.popularMods && analysis.popularMods.length > 0 && (
              <div className="liquid-glass rounded-2xl overflow-hidden">
                <button 
                  onClick={() => setShowAddOns(!showAddOns)}
                  className="w-full p-4 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <Wrench size={16} />
                  <span className="text-xs font-medium uppercase tracking-wider">Add Virtual Mods</span>
                  <span className="ml-auto text-[9px] bg-white/5 text-zinc-500 px-2 py-0.5 rounded-full">Optional</span>
                  <ChevronDown size={16} className={`transition-transform ${showAddOns ? 'rotate-180' : ''}`} />
                </button>
                
                {showAddOns && (
                  <div className="p-4 pt-0 border-t border-white/5">
                    <div className="flex flex-wrap gap-2">
                      {analysis.popularMods.map((mod) => (
                        <button 
                          key={mod.id || mod.name}
                          onClick={() => toggleMod(mod.name)}
                          className={`px-3 py-2 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                            selectedMods.includes(mod.name)
                              ? 'bg-accent text-black'
                              : 'liquid-glass-subtle text-zinc-400 hover:text-white hover:bg-white/10'
                          }`}
                          title={mod.description}
                        >
                          {selectedMods.includes(mod.name) && <Check size={12} />}
                          {mod.name}
                        </button>
                      ))}
                    </div>
                    {selectedMods.length > 0 && (
                      <p className="text-[10px] text-accent mt-3">
                        {selectedMods.length} mod{selectedMods.length > 1 ? 's' : ''} will be added
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Generate Preview Button */}
            <button 
              onClick={handleGeneratePreview}
              className="w-full py-5 bg-accent text-black font-semibold text-base rounded-2xl hover:brightness-110 transition-all pill-btn flex items-center justify-center gap-3 mt-4 animate-glow"
            >
              <Zap size={20} />
              Generate Preview
              <ArrowRight size={20} />
            </button>
            <p className="text-center text-[10px] text-zinc-600 mt-2">Free preview • Pay only if you love it</p>
          </div>
        )}

        {/* PREVIEW STATE - Simple Pricing */}
        {step === Step.PREVIEW && !hasPaid && (
          <div className="space-y-4">
            {/* Success message */}
            <div className="liquid-glass rounded-2xl p-5 text-center specular-edge">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <Check className="text-green-500" size={24} />
              </div>
              <h3 className="text-lg font-semibold mb-1">Your art is ready!</h3>
              <p className="text-zinc-400 text-sm mb-4">Unlock to download in 4K quality</p>
              
              {/* What's included */}
              <div className="liquid-glass-subtle rounded-xl p-4 text-left">
                <div className="flex items-center gap-3 mb-3">
                  <Package className="text-accent" size={20} />
                  <span className="font-semibold">4K Premium Pack</span>
                  <span className="ml-auto text-xl font-bold text-accent">$3.99</span>
                </div>
                <div className="space-y-2 text-sm text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Smartphone size={14} />
                    <span>Phone Wallpaper</span>
                    <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">4K</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Monitor size={14} />
                    <span>Desktop Wallpaper</span>
                    <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">4K</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Printer size={14} />
                    <span>Print Ready</span>
                    <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">4K</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 text-center">
                  <span className="text-[10px] text-zinc-500">✨ Ultra HD quality for all your screens</span>
                </div>
              </div>
            </div>

            {/* Purchase Button - Stripe Checkout */}
            <button 
              onClick={handlePurchase}
              disabled={isProcessingPayment}
              className="w-full py-5 bg-white text-black font-semibold text-base rounded-2xl hover:brightness-95 transition-all pill-btn flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-wait"
            >
              {isProcessingPayment ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <Star size={20} />
                  Unlock 4K Pack - $3.99
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-zinc-600">
              🔒 Secure payment via Stripe
            </p>

            {/* Adjust Button */}
            <button 
              onClick={handleAdjust}
              className="w-full py-4 liquid-glass rounded-xl text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Sliders size={16} />
              Adjust & Regenerate Free
            </button>
          </div>
        )}

        {/* COMPLETE STATE - After Payment */}
        {step === Step.COMPLETE && hasPaid && (
          <div className="space-y-4">
            <div className="liquid-glass rounded-2xl p-4 text-center specular-edge">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-3">
                <Star className="text-accent" size={24} />
              </div>
              <h3 className="text-lg font-semibold mb-1">Thank you!</h3>
              <p className="text-zinc-400 text-sm">Download your art in any format</p>
            </div>

            <div className="space-y-2">
              <button 
                onClick={() => handleDownload('phone')}
                disabled={isDownloading}
                className="w-full py-4 liquid-glass rounded-xl text-sm font-medium text-white hover:bg-white/10 transition-colors flex items-center gap-3 disabled:opacity-50"
              >
                <Smartphone size={18} />
                <span>Phone Wallpaper</span>
                <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">4K</span>
                <Download size={16} className="ml-auto" />
              </button>
              <button 
                onClick={() => handleDownload('desktop')}
                disabled={isDownloading}
                className="w-full py-4 liquid-glass rounded-xl text-sm font-medium text-white hover:bg-white/10 transition-colors flex items-center gap-3 disabled:opacity-50"
              >
                <Monitor size={18} />
                <span>Desktop Wallpaper</span>
                <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">4K</span>
                <Download size={16} className="ml-auto" />
              </button>
              <button 
                onClick={() => handleDownload('print')}
                disabled={isDownloading}
                className="w-full py-4 liquid-glass rounded-xl text-sm font-medium text-white hover:bg-white/10 transition-colors flex items-center gap-3 disabled:opacity-50"
              >
                <Printer size={18} />
                <span>Print Ready</span>
                <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">4K</span>
                <Download size={16} className="ml-auto" />
              </button>
            </div>

            <button 
              onClick={startNew}
              className="w-full py-4 liquid-glass rounded-xl text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              Create Another
            </button>
          </div>
        )}
      </main>

      <footer className="mt-12 text-[10px] text-zinc-700 font-medium">
        RideCanvas • Powered by AI
      </footer>
    </div>
  );
};

// ============ COMPONENTS ============

interface SectionProps {
  number?: number;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ number, title, icon: Icon, children }) => (
  <div className="liquid-glass rounded-2xl p-4 specular-edge relative">
    <div className="flex items-center gap-2 mb-3">
      {number && (
        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center">
          {number}
        </span>
      )}
      <Icon size={16} className="text-zinc-500" />
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
    </div>
    {children}
  </div>
);

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  subtitle?: string;
}

const OptionButton: React.FC<OptionButtonProps> = ({ selected, onClick, icon: Icon, label, subtitle }) => (
  <button 
    onClick={onClick}
    className={`py-3 px-2 rounded-xl flex flex-col items-center gap-1 transition-all pill-btn ${
      selected 
        ? 'liquid-glass-active text-accent' 
        : 'liquid-glass-subtle text-zinc-500 hover:text-zinc-300'
    }`}
  >
    <Icon size={18} />
    <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
    {subtitle && <span className="text-[8px] text-zinc-600">{subtitle}</span>}
  </button>
);

export default App;
