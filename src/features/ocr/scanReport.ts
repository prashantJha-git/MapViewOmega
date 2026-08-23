import { OCRBarrierResult, ReportType, ReportCategory, ReportSeverity } from '../../types/transit';

export interface SampleSign {
  id: string;
  name: string;
  type: string;
  icon: string;
  sampleText: string;
  description: string;
}

export const SAMPLE_BARRIER_SIGNS: SampleSign[] = [
  {
    id: 'sign_elevator_broken',
    name: 'Elevator Out of Service Notice',
    type: 'broken_elevator',
    icon: '🛗',
    sampleText: `NOTICE TO PASSENGERS
ELEVATOR OUT OF SERVICE
Platform B Elevator is undergoing emergency hydraulic repair.
WHEELCHAIR & STROLLER PASSENGERS:
Please use the street-level East Ramp or request Station Attendant assistance at Booth 4.
Estimated Restoration: 22:00.`,
    description: 'Typical transit authority outage notice posted on station elevator doors.',
  },
  {
    id: 'sign_ramp_closed',
    name: 'Wheelchair Ramp Closed Sign',
    type: 'broken_ramp',
    icon: '🚧',
    sampleText: `CAUTION: RAMP CLOSED FOR REPAIRS
Concrete resurfacing and handrail replacement in progress.
NO STEP-FREE ACCESS VIA THIS CORRIDOR.
Accessible detour via North Entrance (200m).
We apologize for the inconvenience.`,
    description: 'Construction alert obstructing step-free pedestrian pathway.',
  },
  {
    id: 'sign_dim_lighting',
    name: 'Lighting Fault / Dark Corridor Sign',
    type: 'dim_lighting',
    icon: '💡',
    sampleText: `FACILITY ADVISORY: LIGHTING OUTAGE
The pedestrian underpass connecting South Quad and Transit Hub has partial illumination failure.
Security escorts available via Blue Light call box.
Work order #LT-9412 submitted. Avoid unlit sections after dusk.`,
    description: 'Facility maintenance notice indicating compromised night visibility.',
  },
  {
    id: 'sign_sos_station',
    name: 'Emergency SOS Station Sign',
    type: 'safe_verified',
    icon: '🛡️',
    sampleText: `EMERGENCY BLUE LIGHT SOS
Direct 2-way audio link to Campus Security & Police Dispatch.
CCTV Monitored 24/7.
Push red button for immediate emergency response.
Station ID: SOS-GATE-02.`,
    description: 'Safety infrastructure sign verifying working emergency assistance kiosk.',
  },
];

/**
 * High-precision regex classifier for barrier and accessibility signage
 */
export function classifyBarrierText(rawText: string): OCRBarrierResult {
  const normalized = rawText.toLowerCase();
  const matchedKeywords: string[] = [];

  let detectedCategory: ReportType = 'obstruction';
  let categoryLabel: ReportCategory = 'Accessibility Barrier';
  let severity: ReportSeverity = 'medium';
  let title = 'Transit Pathway Advisory';
  let details = rawText.trim();
  let suggestedImpact = 'May require alternate accessible path or caution.';
  let confidenceScore = 0.75;
  let suggestedStepFreeImpact = false;
  let suggestedLightingImpact = false;

  // 1. Check for Broken Elevator / Escalator
  if (
    /elevator|lift|escalator/i.test(normalized) &&
    /out of service|out of order|not working|broken|fault|repair|closed|maintenance/i.test(
      normalized
    )
  ) {
    detectedCategory = /escalator/i.test(normalized) ? 'escalator_down' : 'broken_elevator';
    categoryLabel = 'Accessibility Barrier';
    severity = 'critical';
    title = detectedCategory === 'broken_elevator' ? 'Elevator Out of Service' : 'Escalator Down';
    suggestedImpact = 'Step-free access blocked. Wheelchair users must use detour or ramp.';
    suggestedStepFreeImpact = true;
    confidenceScore = 0.96;
    matchedKeywords.push('elevator', 'out of service', 'step-free impact');
  }
  // 2. Check for Ramp Issue / Construction Obstruction
  else if (
    /ramp|wheelchair|stroller|curb|step-free/i.test(normalized) &&
    /closed|blocked|repair|resurfacing|caution|detour|no access/i.test(normalized)
  ) {
    detectedCategory = 'broken_ramp';
    categoryLabel = 'Accessibility Barrier';
    severity = 'high';
    title = 'Wheelchair Ramp Closed / Obstructed';
    suggestedImpact = 'Level grade ramp unavailable. Follow posted detour route.';
    suggestedStepFreeImpact = true;
    confidenceScore = 0.92;
    matchedKeywords.push('ramp closed', 'wheelchair barrier', 'detour');
  }
  // 3. Check for Dim Lighting / Dark Area
  else if (
    /lighting|illumination|streetlight|lamp|dark|underpass|bulb|power outage/i.test(
      normalized
    ) &&
    /outage|failure|unlit|dim|dusk|caution/i.test(normalized)
  ) {
    detectedCategory = 'dim_lighting';
    categoryLabel = 'Safety Issue';
    severity = 'high';
    title = 'Lighting Outage / Low Visibility Corridor';
    suggestedImpact = 'Reduced visibility at night. Recommended to take well-lit main avenue.';
    suggestedLightingImpact = true;
    confidenceScore = 0.9;
    matchedKeywords.push('lighting outage', 'dim corridor', 'safety caution');
  }
  // 4. Check for Emergency SOS / Blue Light
  else if (/sos|blue light|emergency|security dispatch|police/i.test(normalized)) {
    detectedCategory = /emergency call|press for help|active emergency/i.test(normalized)
      ? 'sos_alert'
      : 'safe_verified';
    categoryLabel =
      detectedCategory === 'sos_alert' ? 'Safety Emergency' : 'Safety Commendation';
    severity = detectedCategory === 'sos_alert' ? 'critical' : 'low';
    title =
      detectedCategory === 'sos_alert'
        ? 'Emergency SOS Alert Triggered'
        : 'Verified Safety Blue-Light Station';
    suggestedImpact =
      detectedCategory === 'sos_alert'
        ? 'Active emergency assistance requested.'
        : 'CCTV monitored safe corridor point.';
    confidenceScore = 0.88;
    matchedKeywords.push('blue light', 'sos', 'security');
  }
  // 5. Check for General Obstruction / Hazard
  else if (/caution|danger|wet floor|slippery|blocked|detour|construction/i.test(normalized)) {
    detectedCategory = 'obstruction';
    categoryLabel = 'Accessibility Barrier';
    severity = 'medium';
    title = 'Pedestrian Pathway Obstruction';
    suggestedImpact = 'Pedestrian corridor partially restricted.';
    confidenceScore = 0.82;
    matchedKeywords.push('obstruction', 'pathway detour');
  }

  return {
    rawText,
    detectedCategory,
    categoryLabel,
    severity,
    title,
    details,
    suggestedImpact,
    confidenceScore,
    matchedKeywords,
    suggestedStepFreeImpact,
    suggestedLightingImpact,
  };
}


