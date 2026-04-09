import { useState, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import {
  DEAD_ZONE_CONSECUTIVE_READINGS,
  DEAD_ZONE_COOLDOWN_MS,
} from '../../../lib/config';
import { classifyZone, ZoneState, ZoneInput } from '../services/classify-zone';

export type DeadZoneReason = 'NO_SIGNAL' | 'NO_INTERNET';

export interface DeadZoneState {
  inDeadZone: boolean;
  deadZoneReason: DeadZoneReason | null;
  deadZoneStart: Date | null;
  lastAlertTime: Date | null;
}

export function useDeadZone() {
  const [inDeadZone, setInDeadZone] = useState(false);
  const [deadZoneReason, setDeadZoneReason] = useState<DeadZoneReason | null>(null);
  const [deadZoneStart, setDeadZoneStart] = useState<Date | null>(null);
  const consecutiveDeadRef = useRef(0);
  const consecutiveReasonRef = useRef<DeadZoneReason | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const wasInDeadZoneRef = useRef(false);

  /**
   * Feed a signal reading into the dead zone detector. Accepts the new Phase 1
   * `validated` hint so we can distinguish NO_SIGNAL (radio weak / off) from
   * NO_INTERNET (signal present but Android confirmed data is broken).
   *
   * Both states trigger the alert, but with different banner text. `WEAK` and `OK`
   * never trigger — those mean the user has at least degraded but usable service.
   */
  const processReading = useCallback((input: ZoneInput) => {
    const zone: ZoneState = classifyZone(input);
    const isDead = zone === 'NO_SIGNAL' || zone === 'NO_INTERNET';

    if (isDead) {
      // Reset consecutive counter if the reason changes — we want 3 consecutive
      // readings of the SAME cause before we trust it. Mixing reasons is ambiguous.
      if (consecutiveReasonRef.current !== null && consecutiveReasonRef.current !== zone) {
        consecutiveDeadRef.current = 1;
      } else {
        consecutiveDeadRef.current += 1;
      }
      consecutiveReasonRef.current = zone as DeadZoneReason;

      if (
        consecutiveDeadRef.current >= DEAD_ZONE_CONSECUTIVE_READINGS &&
        !wasInDeadZoneRef.current
      ) {
        const now = Date.now();
        const timeSinceLastAlert = now - lastAlertTimeRef.current;

        if (timeSinceLastAlert >= DEAD_ZONE_COOLDOWN_MS) {
          // TRIGGER DEAD ZONE
          wasInDeadZoneRef.current = true;
          lastAlertTimeRef.current = now;
          setInDeadZone(true);
          setDeadZoneReason(zone as DeadZoneReason);
          setDeadZoneStart(new Date());
          Vibration.vibrate([0, 300, 100, 300]); // double buzz
        }
      }
    } else {
      consecutiveDeadRef.current = 0;
      consecutiveReasonRef.current = null;

      if (wasInDeadZoneRef.current) {
        // SIGNAL RECOVERED
        wasInDeadZoneRef.current = false;
        setInDeadZone(false);
        setDeadZoneReason(null);
        setDeadZoneStart(null);
        Vibration.vibrate(200); // single short buzz
      }
    }
  }, []);

  const reset = useCallback(() => {
    consecutiveDeadRef.current = 0;
    consecutiveReasonRef.current = null;
    wasInDeadZoneRef.current = false;
    lastAlertTimeRef.current = 0;
    setInDeadZone(false);
    setDeadZoneReason(null);
    setDeadZoneStart(null);
  }, []);

  return {
    inDeadZone,
    deadZoneReason,
    deadZoneStart,
    processReading,
    reset,
  };
}
