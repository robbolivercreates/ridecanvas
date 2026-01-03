import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  Upload, Download, 
  RefreshCw, Mountain, Building2, Sparkles, Car,
  Smartphone, Monitor, Trees, Sun, Layers, Zap, Check,
  ChevronDown, Package, Printer, Camera, Aperture, Plus, FolderArchive,
  Scan
} from 'lucide-react';
import { 
  ArtStyle, BackgroundTheme, StanceStyle, 
  VehicleAnalysis, FidelityMode, PositionMode 
} from './types';
import { analyzeVehicle, generateArt, generateRemainingFormats, generateArtSet, fileToGenerativePart, GeneratedArtSet } from './services/geminiService';
import { redirectToCheckout, verifyPayment, checkPaymentStatus, clearPaymentParams } from './services/stripeService';

enum Step {
  UPLOAD = 1,
  ANALYZING = 2,
  CUSTOMIZE = 3,
  GENERATING = 4,
  PREVIEW = 5,
  COMPLETE = 6,
}

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
  
  // Payment
  const [hasPaid, setHasPaid] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // DEV MODE - bypass paywall with ?dev=1
  const isDevMode = new URLSearchParams(window.location.search).get('dev') === '1';

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
        const savedState = localStorage.getItem('ridecanvas_pending_art');
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
          localStorage.removeItem('ridecanvas_pending_art');
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
        // Don't transition yet - let the scan animation play
      } catch (err) {
        console.error('Analysis error:', err);
        setStep(Step.UPLOAD);
        alert("Couldn't analyze that image. Try a clearer photo.");
      }
    }
  };

  const handleGenerate = async () => {
    if (!imageBase64 || !analysis) return;
    setStep(Step.GENERATING);
    setStatusMessage("Creating your artwork...");
    
    try {
      const art = await generateArt(
        imageBase64, analysis, ArtStyle.POSTER, background, 
        fidelity, position, stance, selectedMods
      );
      setPreviewArt(art);
      setStep(Step.PREVIEW);
    } catch (err) {
      console.error('Generation error:', err);
      setStep(Step.CUSTOMIZE);
      alert("Generation failed. Please try again.");
    }
  };

  const handlePurchase = async () => {
    if (!imageBase64 || !analysis || !previewArt) return;
    setIsProcessingPayment(true);
    
    try {
      localStorage.setItem('ridecanvas_pending_art', JSON.stringify({
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

  const handleDownload = (format: 'phone' | 'desktop' | 'print') => {
    if (!artSet || !analysis) return;
    
    // Use correct mimeType and extension
    const mimeType = artSet.mimeType || 'image/png';
    const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${artSet[format]}`;
    link.download = `RideCanvas-${analysis.make}-${analysis.model}-${format}-4K.${extension}`;
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
      
      addToZip(artSet.phone, `${vehicleName}-Phone-4K.${extension}`);
      addToZip(artSet.desktop, `${vehicleName}-Desktop-4K.${extension}`);
      addToZip(artSet.print, `${vehicleName}-Print-4K.${extension}`);
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RideCanvas-${vehicleName}-4K-Pack.zip`;
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Car size={16} className="text-white" />
            </div>
            <span className="font-semibold text-sm">RideCanvas</span>
          </div>
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

      {/* Main Content */}
      <main className="pt-14 pb-8 px-4 max-w-lg mx-auto">
        
        {/* ============ UPLOAD ============ */}
        {step === Step.UPLOAD && (
          <div className="pt-16">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Drop Your Ride</h1>
              <p className="text-zinc-500 text-sm">Side shots look best. Any angle works.</p>
            </div>
            
            <label className="block aspect-[4/3] rounded-3xl border-2 border-dashed border-zinc-800 hover:border-amber-500/50 transition-all cursor-pointer bg-zinc-900/30 hover:bg-zinc-900/50 flex flex-col items-center justify-center group">
              <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleFile} />
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 group-hover:bg-amber-500/20 flex items-center justify-center mb-4 transition-colors">
                <Upload size={28} className="text-zinc-500 group-hover:text-amber-500 transition-colors" />
              </div>
              <span className="text-zinc-300 font-medium">Drop or tap</span>
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

        {/* ============ CUSTOMIZE ============ */}
        {step === Step.CUSTOMIZE && analysis && (
          <div className="pt-4">
            {/* Vehicle Preview Card */}
            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden mb-5 bg-zinc-900">
              <img 
                src={`data:image/jpeg;base64,${imageBase64}`}
                className="w-full h-full object-cover"
                alt="Your vehicle"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">{analysis.year} {analysis.make} {analysis.model}</span>
                {analysis.isOffroad && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">4×4</span>
                )}
              </div>
            </div>

            {/* ─────────────── ANGLE (First and most important choice) ─────────────── */}
            <div className="mb-5">
              <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Choose angle</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPosition(PositionMode.SIDE_PROFILE)}
                  className={`relative p-4 rounded-xl transition-all text-left ${
                    position === PositionMode.SIDE_PROFILE
                      ? 'bg-zinc-800 ring-2 ring-amber-500'
                      : 'bg-zinc-900/50 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Aperture size={16} className={position === PositionMode.SIDE_PROFILE ? 'text-amber-500' : 'text-zinc-500'} />
                    <span className="font-medium text-sm">Side Profile</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    Classic automotive art style. Clean, balanced composition.
                  </p>
                  {position === PositionMode.SIDE_PROFILE && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check size={10} className="text-black" strokeWidth={3} />
                    </div>
                  )}
                </button>
                <button
                  onClick={() => setPosition(PositionMode.AS_PHOTOGRAPHED)}
                  className={`relative p-4 rounded-xl transition-all text-left ${
                    position === PositionMode.AS_PHOTOGRAPHED
                      ? 'bg-zinc-800 ring-2 ring-amber-500'
                      : 'bg-zinc-900/50 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Camera size={16} className={position === PositionMode.AS_PHOTOGRAPHED ? 'text-amber-500' : 'text-zinc-500'} />
                    <span className="font-medium text-sm">As Photographed</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    Keep your photo's exact angle. Unique perspective.
                  </p>
                  {position === PositionMode.AS_PHOTOGRAPHED && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check size={10} className="text-black" strokeWidth={3} />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* ─────────────── SCENE ─────────────── */}
            <div className="mb-5">
              <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Choose a backdrop</label>
              <div className="grid grid-cols-3 gap-2">
                {SCENES.map((scene) => {
                  const isSelected = background === scene.id;
                  const Icon = scene.icon;
                  return (
                    <button
                      key={scene.id}
                      onClick={() => setBackground(scene.id)}
                      className={`relative aspect-[4/3] rounded-xl overflow-hidden transition-all ${
                        isSelected 
                          ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-black scale-[1.02]' 
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${scene.gradient}`} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Icon size={18} className="text-white/90 mb-0.5" />
                        <span className="text-[10px] font-medium text-white/90">{scene.name}</span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                          <Check size={10} className="text-black" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─────────────── FINE-TUNE (Collapsed - Condition, Stance) ─────────────── */}
            <div className="mb-5">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between py-2.5 px-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-medium">Fine-tune</span>
                  <span className="text-[10px] text-zinc-700">optional</span>
                </div>
                <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>
              
              {showAdvanced && (
                <div className="pt-3 space-y-5 border-t border-zinc-900">
                  {/* Condition */}
                  <div>
                    <label className="text-xs text-zinc-600 mb-2 block">Look</label>
                    <div className="flex gap-2">
                      {[
                        { id: FidelityMode.EXACT_MATCH, label: 'As-is', desc: 'dirt & all' },
                        { id: FidelityMode.CLEAN_BUILD, label: 'Clean', desc: 'washed' },
                        { id: FidelityMode.FACTORY_FRESH, label: 'Stock', desc: 'no mods' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setFidelity(opt.id)}
                          className={`flex-1 py-2 px-2 rounded-xl text-center transition-all ${
                            fidelity === opt.id
                              ? 'bg-zinc-800 text-white'
                              : 'bg-zinc-900/50 text-zinc-600 hover:text-zinc-400'
                          }`}
                        >
                          <div className="text-sm font-medium">{opt.label}</div>
                          <div className="text-[10px] opacity-50">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stance */}
                  <div>
                    <label className="text-xs text-zinc-600 mb-2 block">Stance</label>
                    <div className="flex gap-2">
                      {getStanceOptions().map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setStance(opt.id)}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-sm transition-all ${
                            stance === opt.id
                              ? 'bg-zinc-800 text-white font-medium'
                              : 'bg-zinc-900/50 text-zinc-600 hover:text-zinc-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─────────────── DREAM MODS (Last, optional) ─────────────── */}
            {analysis.popularMods && analysis.popularMods.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setShowMods(!showMods)}
                  className="w-full flex items-center justify-between py-2.5 px-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-medium">Dream mods</span>
                    <span className="text-[10px] text-zinc-700">optional</span>
                  </div>
                  <ChevronDown size={14} className={`transition-transform ${showMods ? 'rotate-180' : ''}`} />
                </button>
                
                {showMods && (
                  <div className="pt-3 border-t border-zinc-900">
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.popularMods.slice(0, 6).map((mod) => {
                        const isSelected = selectedMods.includes(mod.name);
                        return (
                          <button
                            key={mod.id || mod.name}
                            onClick={() => toggleMod(mod.name)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-black'
                                : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                            }`}
                          >
                            {isSelected && <span className="mr-1">✓</span>}
                            {mod.name}
                          </button>
                        );
                      })}
                    </div>
                    {selectedMods.length > 0 && (
                      <p className="text-[10px] text-amber-500/80 mt-2">
                        +{selectedMods.length} mod{selectedMods.length > 1 ? 's' : ''} will be added
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Generate Button */}
            <button 
              onClick={handleGenerate}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
            >
              <Sparkles size={20} />
              Create Art
            </button>
            <p className="text-center text-[11px] text-zinc-600 mt-3">Free preview. $3.99 for 4K pack.</p>
          </div>
        )}

        {/* ============ GENERATING ============ */}
        {step === Step.GENERATING && (
          <div className="pt-32 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-zinc-800 border-t-amber-500 animate-spin" />
            <p className="text-zinc-400">{statusMessage}</p>
          </div>
        )}

        {/* ============ PREVIEW ============ */}
        {step === Step.PREVIEW && previewArt && !hasPaid && (
          <div className="pt-4">
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
                className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              
              {/* DEV MODE BUTTON */}
              {isDevMode && (
                <button 
                  onClick={handleDevUnlock}
                  disabled={isProcessingPayment}
                  className="w-full py-3 mt-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  🔓 DEV: Skip Payment
                </button>
              )}
            </div>

            {/* Adjust Button */}
            <button 
              onClick={() => { setPreviewArt(null); setStep(Step.CUSTOMIZE); }}
              className="w-full py-3 text-zinc-500 hover:text-white transition-colors text-sm"
            >
              ← Try different settings
            </button>
          </div>
        )}

        {/* ============ COMPLETE ============ */}
        {step === Step.COMPLETE && hasPaid && artSet && (
          <div className="pt-4">
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
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-3 mb-4 disabled:opacity-50"
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
