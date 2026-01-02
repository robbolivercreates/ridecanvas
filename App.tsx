import React, { useState, useEffect } from 'react';
import { 
  Upload, Image as ImageIcon, Download, ArrowRight, 
  RefreshCw, Mountain, Building2, Sparkles, Car,
  Smartphone, Monitor, Trees, Sun, Layers, Zap, Check,
  ChevronDown, Package, Star, Printer, Settings2
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
  GENERATING = 4,
  PREVIEW = 5,
  COMPLETE = 6,
}

// Scene options with beautiful gradients
const SCENES = [
  { id: BackgroundTheme.SOLID, name: 'Studio', icon: Layers, gradient: 'from-zinc-800 to-zinc-900' },
  { id: BackgroundTheme.MOUNTAINS, name: 'Mountains', icon: Mountain, gradient: 'from-blue-900 to-orange-400' },
  { id: BackgroundTheme.FOREST, name: 'Forest', icon: Trees, gradient: 'from-green-900 to-green-700' },
  { id: BackgroundTheme.DESERT, name: 'Desert', icon: Sun, gradient: 'from-orange-700 to-yellow-500' },
  { id: BackgroundTheme.CITY, name: 'City', icon: Building2, gradient: 'from-slate-800 to-blue-900' },
  { id: BackgroundTheme.NEON, name: 'Neon', icon: Zap, gradient: 'from-purple-900 to-pink-600' },
];

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(Step.UPLOAD);
  
  // Simplified settings - only scene is shown by default
  const [background, setBackground] = useState<BackgroundTheme>(BackgroundTheme.MOUNTAINS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Advanced settings (hidden by default, uses smart defaults)
  const [fidelity, setFidelity] = useState<FidelityMode>(FidelityMode.CLEAN_BUILD);
  const [position, setPosition] = useState<PositionMode>(PositionMode.AS_PHOTOGRAPHED);
  const [stance, setStance] = useState<StanceStyle>(StanceStyle.STOCK);
  
  // Data
  const [analysis, setAnalysis] = useState<VehicleAnalysis | null>(null);
  const [previewArt, setPreviewArt] = useState<string | null>(null);
  const [artSet, setArtSet] = useState<GeneratedArtSet | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  
  // Payment
  const [hasPaid, setHasPaid] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setHasApiKey(true);
    }
  }, []);

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
    if (analysis?.suggestedBackground) {
      const bgMap: Record<string, BackgroundTheme> = {
        'Studio Clean': BackgroundTheme.SOLID,
        'Mountain Peaks': BackgroundTheme.MOUNTAINS,
        'Nordic Forest': BackgroundTheme.FOREST,
        'Desert Dunes': BackgroundTheme.DESERT,
        'City Skyline': BackgroundTheme.CITY,
        'Neon Night': BackgroundTheme.NEON,
      };
      setBackground(bgMap[analysis.suggestedBackground as string] || BackgroundTheme.MOUNTAINS);
    }
  }, [analysis]);

  const handlePaymentReturn = async (sessionId: string) => {
    setIsProcessingPayment(true);
    setStatusMessage("Creating your 4K wallpapers...");
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
          
          const set = await generateArtSet(
            state.imageBase64, state.analysis, ArtStyle.POSTER, 
            state.background, state.fidelity || FidelityMode.CLEAN_BUILD, 
            state.position || PositionMode.AS_PHOTOGRAPHED,
            state.stance || StanceStyle.STOCK, [], 
            apiKey || localStorage.getItem('gemini_api_key') || '',
            (progress) => setStatusMessage(progress)
          );
          
          setArtSet(set);
          setHasPaid(true);
          setStep(Step.COMPLETE);
          localStorage.removeItem('ridecanvas_pending_art');
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      setStep(Step.PREVIEW);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setHasApiKey(true);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const base64 = await fileToGenerativePart(e.target.files[0]);
      setImageBase64(base64);
      setPreviewArt(null);
      setArtSet(null);
      setHasPaid(false);
      setStep(Step.ANALYZING);
      setStatusMessage("Analyzing your ride...");
      
      try {
        const res = await analyzeVehicle(base64, apiKey);
        setAnalysis(res);
        setStep(Step.CUSTOMIZE);
      } catch {
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
        fidelity, position, stance, [], apiKey
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
    
    try {
      localStorage.setItem('ridecanvas_pending_art', JSON.stringify({
        imageBase64, analysis, background, fidelity, position, stance
      }));
      await redirectToCheckout(
        `art_${Date.now()}`,
        `${analysis.year} ${analysis.make} ${analysis.model}`
      );
    } catch {
      setIsProcessingPayment(false);
      alert("Checkout failed. Please try again.");
    }
  };

  const handleDownload = (format: 'phone' | 'desktop' | 'print') => {
    if (!artSet || !analysis) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${artSet[format]}`;
    link.download = `RideCanvas-${analysis.make}-${analysis.model}-${format}.png`;
    link.click();
  };

  const startNew = () => {
    setImageBase64(null);
    setPreviewArt(null);
    setArtSet(null);
    setAnalysis(null);
    setHasPaid(false);
    setShowAdvanced(false);
    setStep(Step.UPLOAD);
  };

  // ============ API KEY SCREEN ============
  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Car className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">RideCanvas</h1>
          <p className="text-zinc-500 mb-8">Turn your ride into wall-worthy art</p>
          
          <form onSubmit={handleApiKeySubmit} className="space-y-4">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste Gemini API Key"
              className="w-full px-5 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
            <button 
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity"
            >
              Get Started
            </button>
          </form>
          <p className="text-zinc-600 text-xs mt-6">
            Get your free API key at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-amber-500 hover:underline">aistudio.google.com</a>
          </p>
        </div>
      </div>
    );
  }

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
              className="text-xs text-zinc-500 hover:text-white transition-colors"
            >
              + New
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14 pb-8 px-4 max-w-lg mx-auto">
        
        {/* ============ UPLOAD ============ */}
        {step === Step.UPLOAD && (
          <div className="pt-20">
            <div className="text-center mb-10">
              <h1 className="text-2xl font-bold mb-2">Upload Your Ride</h1>
              <p className="text-zinc-500 text-sm">Side profile works best</p>
            </div>
            
            <label className="block aspect-[4/3] rounded-3xl border-2 border-dashed border-zinc-800 hover:border-amber-500/50 transition-colors cursor-pointer bg-zinc-900/50 flex flex-col items-center justify-center">
              <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleFile} />
              <Upload size={40} className="text-zinc-600 mb-4" />
              <span className="text-zinc-400 font-medium">Tap to upload</span>
              <span className="text-zinc-600 text-sm mt-1">or drag & drop</span>
            </label>
          </div>
        )}

        {/* ============ ANALYZING ============ */}
        {step === Step.ANALYZING && (
          <div className="pt-20 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-zinc-800 border-t-amber-500 animate-spin" />
            <p className="text-zinc-400">{statusMessage}</p>
          </div>
        )}

        {/* ============ CUSTOMIZE ============ */}
        {step === Step.CUSTOMIZE && analysis && (
          <div className="pt-6">
            {/* Vehicle Preview */}
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden mb-6 bg-zinc-900">
              <img 
                src={`data:image/jpeg;base64,${imageBase64}`}
                className="w-full h-full object-cover"
                alt="Your vehicle"
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">{analysis.year} {analysis.make} {analysis.model}</span>
                </div>
              </div>
            </div>

            {/* Scene Selection - Main Option */}
            <div className="mb-6">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Choose Scene</h3>
              <div className="grid grid-cols-3 gap-2">
                {SCENES.map((scene) => {
                  const isSelected = background === scene.id;
                  const Icon = scene.icon;
                  return (
                    <button
                      key={scene.id}
                      onClick={() => setBackground(scene.id)}
                      className={`relative aspect-square rounded-2xl overflow-hidden transition-all ${
                        isSelected ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-black scale-[1.02]' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${scene.gradient}`} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Icon size={20} className="text-white/80 mb-1" />
                        <span className="text-[10px] font-medium text-white/80">{scene.name}</span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                          <Check size={12} className="text-black" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Advanced Options - Collapsed by default */}
            <div className="mb-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between py-3 text-zinc-500 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings2 size={16} />
                  <span className="text-sm">Advanced options</span>
                </div>
                <ChevronDown size={16} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>
              
              {showAdvanced && (
                <div className="pt-4 space-y-4 border-t border-zinc-800">
                  {/* Condition */}
                  <div>
                    <label className="text-xs text-zinc-600 mb-2 block">Condition</label>
                    <div className="flex gap-2">
                      {[
                        { id: FidelityMode.EXACT_MATCH, label: 'As-Is' },
                        { id: FidelityMode.CLEAN_BUILD, label: 'Clean' },
                        { id: FidelityMode.FACTORY_FRESH, label: 'Stock' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setFidelity(opt.id)}
                          className={`flex-1 py-2 px-3 rounded-xl text-sm transition-all ${
                            fidelity === opt.id
                              ? 'bg-white text-black font-medium'
                              : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stance */}
                  <div>
                    <label className="text-xs text-zinc-600 mb-2 block">Stance</label>
                    <div className="flex gap-2">
                      {[
                        { id: StanceStyle.STOCK, label: 'Stock' },
                        { id: StanceStyle.LIFTED, label: 'Lifted' },
                        { id: StanceStyle.LOWERED, label: 'Lowered' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setStance(opt.id)}
                          className={`flex-1 py-2 px-3 rounded-xl text-sm transition-all ${
                            stance === opt.id
                              ? 'bg-white text-black font-medium'
                              : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
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

            {/* Generate Button */}
            <button 
              onClick={handleGenerate}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Sparkles size={20} />
              Generate Preview
            </button>
            <p className="text-center text-xs text-zinc-600 mt-3">Free to preview • Pay only for downloads</p>
          </div>
        )}

        {/* ============ GENERATING ============ */}
        {step === Step.GENERATING && (
          <div className="pt-20 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-zinc-800 border-t-amber-500 animate-spin" />
            <p className="text-zinc-400">{statusMessage}</p>
          </div>
        )}

        {/* ============ PREVIEW ============ */}
        {step === Step.PREVIEW && previewArt && !hasPaid && (
          <div className="pt-6">
            {/* Preview Image */}
            <div className="relative aspect-[9/16] rounded-3xl overflow-hidden mb-6 bg-zinc-900">
              <img 
                src={`data:image/png;base64,${previewArt}`}
                className="w-full h-full object-contain blur-[6px] opacity-90"
                alt="Preview"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                    <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-white/80 font-medium">Preview</p>
                </div>
              </div>
            </div>

            {/* Pricing Card */}
            <div className="bg-zinc-900 rounded-3xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Package className="text-amber-500" size={24} />
                  <div>
                    <h3 className="font-semibold">4K Premium Pack</h3>
                    <p className="text-xs text-zinc-500">3 formats included</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-amber-500">$3.99</span>
              </div>
              
              <div className="flex gap-2 mb-4">
                <div className="flex-1 bg-zinc-800 rounded-xl p-3 text-center">
                  <Smartphone size={18} className="mx-auto mb-1 text-zinc-400" />
                  <span className="text-[10px] text-zinc-500">Phone</span>
                </div>
                <div className="flex-1 bg-zinc-800 rounded-xl p-3 text-center">
                  <Monitor size={18} className="mx-auto mb-1 text-zinc-400" />
                  <span className="text-[10px] text-zinc-500">Desktop</span>
                </div>
                <div className="flex-1 bg-zinc-800 rounded-xl p-3 text-center">
                  <Printer size={18} className="mx-auto mb-1 text-zinc-400" />
                  <span className="text-[10px] text-zinc-500">Print</span>
                </div>
              </div>

              <button 
                onClick={handlePurchase}
                disabled={isProcessingPayment}
                className="w-full py-4 bg-white text-black font-semibold rounded-2xl hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Star size={18} />
                    Unlock Downloads
                  </>
                )}
              </button>
            </div>

            {/* Adjust Button */}
            <button 
              onClick={() => { setPreviewArt(null); setStep(Step.CUSTOMIZE); }}
              className="w-full py-3 text-zinc-500 hover:text-white transition-colors text-sm"
            >
              ← Adjust & regenerate
            </button>
          </div>
        )}

        {/* ============ COMPLETE ============ */}
        {step === Step.COMPLETE && hasPaid && artSet && (
          <div className="pt-6">
            {/* Success Image */}
            <div className="relative aspect-[9/16] rounded-3xl overflow-hidden mb-6 bg-zinc-900">
              <img 
                src={`data:image/png;base64,${artSet.phone}`}
                className="w-full h-full object-contain"
                alt="Your artwork"
              />
            </div>

            {/* Download Buttons */}
            <div className="space-y-2 mb-6">
              <button 
                onClick={() => handleDownload('phone')}
                className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-colors flex items-center justify-between px-5"
              >
                <div className="flex items-center gap-3">
                  <Smartphone size={20} className="text-zinc-400" />
                  <span className="font-medium">Phone Wallpaper</span>
                  <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded">4K</span>
                </div>
                <Download size={18} className="text-zinc-400" />
              </button>
              
              <button 
                onClick={() => handleDownload('desktop')}
                className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-colors flex items-center justify-between px-5"
              >
                <div className="flex items-center gap-3">
                  <Monitor size={20} className="text-zinc-400" />
                  <span className="font-medium">Desktop Wallpaper</span>
                  <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded">4K</span>
                </div>
                <Download size={18} className="text-zinc-400" />
              </button>
              
              <button 
                onClick={() => handleDownload('print')}
                className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-colors flex items-center justify-between px-5"
              >
                <div className="flex items-center gap-3">
                  <Printer size={20} className="text-zinc-400" />
                  <span className="font-medium">Print Ready</span>
                  <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded">4K</span>
                </div>
                <Download size={18} className="text-zinc-400" />
              </button>
            </div>

            {/* New Button */}
            <button 
              onClick={startNew}
              className="w-full py-4 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-colors flex items-center justify-center gap-2 text-zinc-400 hover:text-white"
            >
              <RefreshCw size={18} />
              Create Another
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
