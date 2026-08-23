/**
 * Real OCR plumbing for the Scan & Report feature.
 *
 * Honesty contract with the UI: every result this module returns is tagged
 * with a `source` so the panel can tell the user, truthfully, whether the
 * text on screen came from actually reading pixels or from a labeled demo
 * fallback. Nothing here silently fabricates "OCR output" from a filename.
 *
 * What's real today, with zero extra dependencies / no network required:
 *   - `openCamera()` / `captureFrame()` genuinely use getUserMedia and grab
 *     a real frame from the device camera.
 *   - `extractTextFromImage()` genuinely reads pixels using the browser's
 *     native Shape Detection `TextDetector` API, where that API exists
 *     (Chrome/Chromium on Android today; occasionally desktop behind a flag).
 *
 * What's still a fallback, and clearly labeled as such in the UI:
 *   - Browsers without `TextDetector` (most desktop Chrome, Firefox, Safari
 *     as of this writing) have no built-in OCR API. In that case this module
 *     returns `null` and the panel falls back to an explicitly-labeled demo
 *     classification instead of pretending to have read the image.
 *
 * To get real, cross-browser OCR: `npm install tesseract.js`, then wire the
 * commented-out `extractTextWithTesseract` function below into
 * ScanReportPanel.tsx in place of / alongside the native detector call.
 * That's the one dependency this project doesn't yet have installed
 * (no network access was available when this pass was written).
 */

export type OcrSource = 'live_ocr' | 'demo_simulation';

export interface OcrExtractionResult {
  text: string;
  source: OcrSource;
  engine: string;
}

/** True only when the browser exposes the experimental native
 * Shape Detection `TextDetector` API. */
export function hasNativeTextDetector(): boolean {
  return typeof (window as any).TextDetector === 'function';
}

/**
 * Attempt real OCR using the native TextDetector API. Returns null (never
 * throws) when the API is unavailable or detects nothing, so callers can
 * cleanly fall back to a labeled demo path.
 */
export async function extractTextFromImage(
  source: ImageBitmapSource
): Promise<OcrExtractionResult | null> {
  if (!hasNativeTextDetector()) return null;

  try {
    const TextDetectorCtor = (window as any).TextDetector;
    const detector = new TextDetectorCtor();
    const detections = await detector.detect(source);
    if (!detections || detections.length === 0) return null;

    const text = detections
      .map((d: any) => d.rawValue)
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!text) return null;
    return { text, source: 'live_ocr', engine: 'Native TextDetector API' };
  } catch (err) {
    console.warn('[ocrEngine] Native text detection failed, falling back to demo mode:', err);
    return null;
  }
}

/** Opens the device camera. Caller must stop the returned stream's tracks
 * (e.g. `stream.getTracks().forEach(t => t.stop())`) when finished. */
export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported in this browser.');
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });
}

/** Grabs the current frame from a playing <video> element onto a canvas. */
export function captureFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Loads a File into an <img> element, resolving once it's decoded and
 * ready to hand to extractTextFromImage / draw to a canvas. */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = err => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Optional: cross-browser OCR via tesseract.js.
// Not active by default — this package isn't installed yet. To enable:
//   1. npm install tesseract.js
//   2. Uncomment the block below
//   3. In ScanReportPanel.tsx, try this after extractTextFromImage() returns
//      null, before falling back to the demo path.
// ---------------------------------------------------------------------------
// import { createWorker } from 'tesseract.js';
//
// export async function extractTextWithTesseract(
//   image: string | HTMLCanvasElement | HTMLImageElement
// ): Promise<OcrExtractionResult> {
//   const worker = await createWorker('eng');
//   const { data } = await worker.recognize(image);
//   await worker.terminate();
//   return { text: data.text, source: 'live_ocr', engine: 'tesseract.js' };
// }
