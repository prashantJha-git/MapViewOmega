import React, { useState, useRef, useEffect } from 'react';
import { SAMPLE_BARRIER_SIGNS, classifyBarrierText, SampleSign } from './scanReport';
import {
  hasNativeTextDetector,
  extractTextFromImage,
  openCamera,
  captureFrame,
  loadImageFile,
  OcrSource,
} from './ocrEngine';
import { OCRBarrierResult, CommunityReport, TransitStop } from '../../types/transit';

interface ScanReportPanelProps {
  stops: TransitStop[];
  onApplyReport?: (reportData: Partial<CommunityReport>) => void;
  onClose?: () => void;
}

export const ScanReportPanel: React.FC<ScanReportPanelProps> = ({
  stops,
  onApplyReport,
  onClose,
}) => {
  const [selectedSample, setSelectedSample] = useState<SampleSign>(SAMPLE_BARRIER_SIGNS[0]);
  const [customText, setCustomText] = useState<string>(SAMPLE_BARRIER_SIGNS[0].sampleText);
  const [selectedStopId, setSelectedStopId] = useState<string>(stops[0]?.id || 'stop_gate');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<OCRBarrierResult | null>(() =>
    classifyBarrierText(SAMPLE_BARRIER_SIGNS[0].sampleText)
  );

  // Honest OCR provenance: was this text actually read from pixels, or is
  // it a labeled demo sample? Starts null (nothing analyzed yet).
  const [ocrSource, setOcrSource] = useState<OcrSource | null>(null);
  const [ocrEngineLabel, setOcrEngineLabel] = useState<string>('');

  // Camera modal state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const nativeOcrAvailable = hasNativeTextDetector();

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  useEffect(() => stopCamera, []); // cleanup on unmount

  const runAnalysis = async (text: string, source: OcrSource, engineLabel: string) => {
    setIsProcessing(true);
    setProgress(30);
    await new Promise(r => setTimeout(r, 80));
    setProgress(75);
    await new Promise(r => setTimeout(r, 80));
    setProgress(100);

    const classification = classifyBarrierText(text);
    setResult(classification);
    setOcrSource(source);
    setOcrEngineLabel(engineLabel);
    setIsProcessing(false);
  };

  const handleSelectSample = (sample: SampleSign) => {
    setSelectedSample(sample);
    setCustomText(sample.sampleText);
    // Picking a canned sample is explicitly a demo action, not OCR.
    runAnalysis(sample.sampleText, 'demo_simulation', 'Sample sign (no image analyzed)');
  };

  // --- Camera flow -----------------------------------------------------
  const handleOpenCamera = async () => {
    setCameraError(null);
    try {
      const stream = await openCamera();
      streamRef.current = stream;
      setCameraOpen(true);
      // Video element isn't mounted yet on first render of this tick;
      // attach once the modal renders.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      setCameraError(
        'Could not access the camera (permission denied, no camera present, or unsupported browser).'
      );
    }
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = captureFrame(videoRef.current);
    stopCamera();

    setIsProcessing(true);
    setProgress(20);

    const detected = await extractTextFromImage(canvas);
    if (detected && detected.text.trim()) {
      await runAnalysis(detected.text, detected.source, detected.engine);
    } else {
      // Honest fallback: no real OCR engine available / nothing detected.
      // Do NOT fabricate text — say so, and show a representative demo sign.
      const demoSample = SAMPLE_BARRIER_SIGNS[0];
      setCustomText(demoSample.sampleText);
      await runAnalysis(
        demoSample.sampleText,
        'demo_simulation',
        nativeOcrAvailable
          ? 'Live OCR ran but found no readable text in this photo'
          : 'Demo Mode — this browser has no built-in OCR engine (Chrome on Android does)'
      );
    }
  };

  // --- Upload flow -------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(20);

    try {
      const img = await loadImageFile(file);
      setProgress(50);
      const detected = await extractTextFromImage(img);

      if (detected && detected.text.trim()) {
        await runAnalysis(detected.text, detected.source, detected.engine);
        return;
      }

      // Honest fallback — we explicitly do NOT infer anything from the
      // filename. We say plainly that no real text was extracted.
      const demoSample = SAMPLE_BARRIER_SIGNS[1];
      setCustomText(demoSample.sampleText);
      await runAnalysis(
        demoSample.sampleText,
        'demo_simulation',
        nativeOcrAvailable
          ? 'Live OCR ran but found no readable text in this image'
          : 'Demo Mode — this browser has no built-in OCR engine (Chrome on Android does)'
      );
    } catch (err) {
      setIsProcessing(false);
      setCameraError('Could not read that image file.');
    }
  };

  const handleApplyToCommunityReport = () => {
    if (!result) return;
    const selectedStop = stops.find(s => s.id === selectedStopId);

    const newReport: Partial<CommunityReport> = {
      stopId: selectedStopId,
      stopName: selectedStop?.name || 'Campus Corridor',
      type: result.detectedCategory,
      category: result.categoryLabel,
      title: result.title,
      details: result.details,
      impact: result.suggestedImpact,
      severity: result.severity,
      status: 'active',
      timestamp: 'Just now (via OCR Scan)',
      upvotes: 1,
    };

    if (onApplyReport) {
      onApplyReport(newReport);
    }
  };

  const isLive = ocrSource === 'live_ocr';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-xl">
            📷
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Scan & Report: OCR Barrier Classifier
            </h2>
            <p className="text-xs text-slate-400">
              Point your camera or upload signage (broken elevator, ramp closure, dark corridor) to auto-classify & report
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-800"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Engine capability banner — always honest about what will happen */}
      <div
        className={`rounded-xl border px-4 py-2.5 text-xs flex items-center gap-2 ${
          nativeOcrAvailable
            ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
            : 'bg-amber-950/40 border-amber-800 text-amber-300'
        }`}
      >
        <span>{nativeOcrAvailable ? '🟢' : '🟡'}</span>
        <span>
          {nativeOcrAvailable
            ? 'This browser supports on-device text detection — camera/upload scans will run real OCR.'
            : "This browser has no built-in OCR engine, so camera/upload scans will fall back to a clearly-labeled demo classification. (Chrome on Android has native support; tesseract.js can be added for full cross-browser OCR.)"}
        </span>
      </div>

      {cameraError && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-2.5 text-xs text-rose-300">
          {cameraError}
        </div>
      )}

      {/* Camera Modal */}
      {cameraOpen && (
        <div className="bg-black rounded-2xl overflow-hidden border border-slate-700 space-y-0">
          <video ref={videoRef} className="w-full max-h-80 object-cover bg-black" muted playsInline />
          <div className="flex items-center justify-between p-3 bg-slate-950">
            <button
              onClick={stopCamera}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCapturePhoto}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
            >
              📸 Capture Photo
            </button>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Selection (Samples, Upload, Custom Text) */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
              1. Choose a Test Sign or Scan a Real Photo
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SAMPLE_BARRIER_SIGNS.map(sample => (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedSample.id === sample.id
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{sample.icon}</span>
                    <span className="font-bold text-xs line-clamp-1">{sample.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-1">
                    {sample.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Upload / Camera Buttons */}
          <div className="flex items-center space-x-3">
            <label className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 hover:bg-slate-800/50 cursor-pointer text-xs text-slate-300 font-semibold transition-colors">
              <span>📁 Upload Sign Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleOpenCamera}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <span>📸 Open Camera</span>
            </button>
          </div>

          {/* Extracted / Editable OCR Text */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              {isLive ? 'Text Extracted From Image (editable)' : 'Sample / Demo Text (editable)'}
            </label>
            <textarea
              rows={5}
              value={customText}
              onChange={e => {
                setCustomText(e.target.value);
                runAnalysis(e.target.value, ocrSource ?? 'demo_simulation', ocrEngineLabel || 'Manual text edit');
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
              placeholder="OCR extracted text will appear here..."
            />
          </div>

          {/* Stop Geotag Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Geotag Location / Nearest Stop
            </label>
            <select
              value={selectedStopId}
              onChange={e => setSelectedStopId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:border-emerald-500 focus:outline-none"
            >
              {stops.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) - {s.zone}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Real-Time Classification Result */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                OCR Classification Breakdown
              </h3>
              {isProcessing ? (
                <span className="text-xs text-emerald-400 font-mono animate-pulse">
                  Analyzing {progress}%...
                </span>
              ) : (
                <span className="text-xs text-emerald-400 font-mono">
                  Confidence: {Math.round((result?.confidenceScore || 0) * 100)}%
                </span>
              )}
            </div>

            {/* Provenance badge: never let the UI imply OCR when it wasn't */}
            {ocrSource && (
              <div
                className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg inline-block ${
                  isLive
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}
              >
                {isLive ? `🟢 Live OCR — ${ocrEngineLabel}` : `🟡 Demo Mode — ${ocrEngineLabel}`}
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold">
                    {result.detectedCategory === 'broken_elevator'
                      ? '🛗'
                      : result.detectedCategory === 'broken_ramp'
                      ? '🚧'
                      : result.detectedCategory === 'dim_lighting'
                      ? '💡'
                      : result.detectedCategory === 'safe_verified'
                      ? '🛡️'
                      : '⚠️'}
                  </span>
                  <div>
                    <h4 className="font-bold text-base text-white">{result.title}</h4>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {result.categoryLabel}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          result.severity === 'critical'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : result.severity === 'high'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}
                      >
                        Severity: {result.severity}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5">
                  <div className="font-semibold text-slate-300">Accessibility Impact:</div>
                  <p className="text-slate-400">{result.suggestedImpact}</p>
                </div>

                {/* Keyword Pills */}
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block mb-1.5">
                    Matched Semantic Keywords:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.matchedKeywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center space-x-3">
            <button
              onClick={handleApplyToCommunityReport}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2"
            >
              <span>✓ Auto-Fill & Post Community Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
