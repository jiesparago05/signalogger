// Phase 1 real-connectivity classification — see docs/superpowers/plans/2026-04-10-phase1-*.md
//
// Collapses a reading into one of four user-visible states. Intentionally simple:
// only dBm + validated drive the decision. downKbps is deliberately NOT used for
// classification because modem bandwidth estimates are too noisy to trust for UX.
//
// Important: `validated` is probabilistic (Android probes periodically, not in
// real-time). Never trigger irreversible decisions on a single reading — callers
// that alert must debounce with consecutive-reading thresholds.

import {
  DEAD_ZONE_THRESHOLD,
  STRONG_DBM_THRESHOLD,
} from '../../../lib/config';

export type ZoneState = 'OK' | 'WEAK' | 'NO_INTERNET' | 'NO_SIGNAL';

export interface ZoneInput {
  dbm: number;
  validated?: boolean;
  networkType?: string;
}

export function classifyZone(input: ZoneInput): ZoneState {
  const { dbm, validated, networkType } = input;

  // Radio actually off (native returns networkType === 'none') counts as no signal.
  if (networkType === 'none') return 'NO_SIGNAL';

  // Native read failed — treat as no signal (same as existing dead-zone logic).
  // dbm === -999 means the native module couldn't get a value.
  if (dbm === -999) return 'NO_SIGNAL';

  // Genuinely weak signal — below the dead-zone threshold the radio can't sustain data.
  if (dbm <= DEAD_ZONE_THRESHOLD) return 'NO_SIGNAL';

  // Signal present, but Android confirmed internet is broken.
  // Only trigger on EXPLICIT false — `undefined` is ambiguous (old data / not yet probed).
  if (validated === false) return 'NO_INTERNET';

  // Signal present and internet confirmed working.
  if (dbm > STRONG_DBM_THRESHOLD && validated === true) return 'OK';

  // Everything else: signal is mid-range, OR validated is undefined (unverified),
  // OR signal is strong but validated not yet confirmed. Surface as "working but degraded."
  return 'WEAK';
}
