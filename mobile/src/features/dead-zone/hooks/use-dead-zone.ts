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
    // Only dead if networkType is 'none' (radio actually off) or signal is genuinely weak
    // Note: -999 with valid networkType means native module failed to read — NOT a dead zone
    const radioOff = networkType === 'none';
    const weakSignal = dbm > -999 && dbm < DEAD_ZONE_THRESHOLD;
    const isDead = radioOff || weakSignal;

    if (isDead) {
      consecutiveDeadRef.current += 1;

      // Always wait for consecutive readings to avoid false triggers on app startup
      const threshold = DEAD_ZONE_CONSECUTIVE_READINGS;

      if (
        consecutiveDeadRef.current >= threshold &&
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
