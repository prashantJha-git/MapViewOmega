/**
 * P2P pairing "QR" note.
 *
 * The previous version of this file rendered an SVG that *looked* like a QR
 * code (finder squares + a hash-derived speckle pattern) but was not a real
 * QR encoding — no phone camera could ever decode it, and the pairing token
 * was silently truncated to 120 characters first, which would have
 * corrupted a real handshake anyway. That's been removed rather than
 * "improved," because a QR code that looks legitimate but doesn't scan is
 * worse than no QR code.
 *
 * Why there's no real QR here yet: a WebRTC SDP offer/answer (with ICE
 * candidates embedded, since this app has no signaling server to trickle
 * candidates through) typically runs to 1-3+ KB of text. That doesn't
 * reliably fit — or reliably *scan* — as a single QR code, which is why
 * production WebRTC-pairing tools generally use a short room code plus a
 * relay/signaling server instead of stuffing the whole SDP into a QR image.
 * This app is intentionally serverless, so that option isn't a fit either.
 *
 * The reliable, fully-working pairing path today is the copy/paste + native
 * Share flow already wired up in SyncPanel.tsx — that's real and tested.
 *
 * If you want an actual scannable QR code for short answer tokens:
 *   1. npm install qrcode
 *   2. import QRCode from 'qrcode' and render its data-URL/SVG output
 *      wherever `canFitInQr(token)` (below) returns true.
 * That's a well-tested, one-line integration — safer than a hand-rolled
 * Reed-Solomon QR encoder that can't be verified against a real scanner
 * without network/device access.
 */

/** Conservative byte ceiling under which a QR code is *plausible* to
 * generate and scan reliably. Real capacity depends on the QR version/EC
 * level chosen by whatever encoder is wired in; this is just a sanity gate
 * so the UI doesn't try to force huge payloads into a QR at all. */
const QR_PLAUSIBLE_BYTE_LIMIT = 800;

export function canFitInQr(token: string): boolean {
  return new Blob([token]).size <= QR_PLAUSIBLE_BYTE_LIMIT;
}
