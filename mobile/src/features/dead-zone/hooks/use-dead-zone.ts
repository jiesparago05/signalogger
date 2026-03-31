import { useState, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import {
  DEAD_ZONE_THRESHOLD,
  DEAD_ZONE_CONSECUTIVE_READINGS,
  DEAD_ZONE_COOLDOWN_MS,
} from '../../../lib/config';

export interface DeadZoneState {
  inDeadZone: boolean;
  deadZoneStart: Date | null;
  lastAlertTime: Date | null;
}

export function useDeadZone() {
  const [inDeadZone, setInDeadZone] = useState(false);
  const [deadZoneStart, setDeadZoneStart] = useState<Date | null>(null);
  const consecutiveDeadRef = useRef(0);
  const lastAlertTimeRef = useRef<number>(0);
  const wasInDeadZoneRef = useRef(false);

  const processReading = useCallback((dbm: number, carrier?: string, networkType?: string) => {
    // Skip invalid readings (location off) — handled separately by SignalDisplay
    if (dbm <= -999) return;

    const isDead = dbm < DEAD_ZONE_THRESHOLD;

    if (isDead) {
      consecutiveDeadRef.current += 1;

      // Check if we should trigger dead zone alert
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
          setDeadZoneStart(new Date());
          Vibration.vibrate([0, 300, 100, 300]); // double buzz
        }
      }
    } else {
      consecutiveDeadRef.current = 0;

      if (wasInDeadZoneRef.current) {
        // SIGNAL RECOVERED
        wasInDeadZoneRef.current = false;
        setInDeadZone(false);
        setDeadZoneStart(null);
        Vibration.vibrate(200); // single short buzz
      }
    }
  }, []);

  const reset = useCallback(() => {
    consecutiveDeadRef.current = 0;
    wasInDeadZoneRef.current = false;
    lastAlertTimeRef.current = 0;
    setInDeadZone(false);
    setDeadZoneStart(null);
  }, []);

  return {
    inDeadZone,
    deadZoneStart,
    processReading,
    reset,
  };
}
