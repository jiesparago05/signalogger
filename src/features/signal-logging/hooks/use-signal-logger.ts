import { useState, useEffect, useCallback, useRef } from 'react';
import {
  startLogging,
  stopLogging,
  isLoggingActive,
  setOnLog,
  setLoggingConfig,
  getLoggingConfig,
} from '../services/background-logger';
import { readSignal, RawSignalReading } from '../services/signal-reader';
import { addSignalLog } from '../../offline-sync/services/log-store';
import { SignalLog, LoggingConfig } from '../../../types/signal';

const HISTORY_SIZE = 15;

export interface SignalStability {
  min: number;
  max: number;
  rangeDiff: number;
  label: 'Stable' | 'Fluctuating' | 'Unstable';
}

function computeStability(history: number[]): SignalStability | null {
  if (history.length < 3) return null;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const rangeDiff = max - min;
  let label: SignalStability['label'] = 'Stable';
  if (rangeDiff > 25) label = 'Unstable';
  else if (rangeDiff > 10) label = 'Fluctuating';
  return { min, max, rangeDiff, label };
}

export function useSignalLogger(onNewLog?: (log: SignalLog) => void) {
  const [isActive, setIsActive] = useState(isLoggingActive());
  const [currentSignal, setCurrentSignal] = useState<RawSignalReading | null>(null);
  const [stability, setStability] = useState<SignalStability | null>(null);
  const [config, setConfig] = useState<LoggingConfig>(getLoggingConfig());
  const historyRef = useRef<number[]>([]);

  const addToHistory = useCallback((dbm: number) => {
    if (dbm <= -999) return; // skip invalid readings
    const h = historyRef.current;
    h.push(dbm);
    if (h.length > HISTORY_SIZE) h.shift();
    setStability(computeStability(h));
  }, []);

  useEffect(() => {
    setOnLog(async (log: SignalLog) => {
      // Save to offline queue
      await addSignalLog(log);

      // Update UI
      setCurrentSignal({
        carrier: log.carrier as RawSignalReading['carrier'],
        networkType: log.networkType,
        signal: log.signal,
        connection: log.connection,
      });
      addToHistory(log.signal.dbm);
      onNewLog?.(log);
    });
  }, [onNewLog, addToHistory]);

  // Poll current signal for display (every 5s)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const signal = await readSignal();
        setCurrentSignal(signal);
        addToHistory(signal.signal.dbm);
      } catch {}
    }, 5000);

    // Read immediately
    readSignal()
      .then((s) => {
        setCurrentSignal(s);
        addToHistory(s.signal.dbm);
      })
      .catch(() => {});

    return () => clearInterval(interval);
  }, [addToHistory]);

  const toggle = useCallback(async () => {
    if (isActive) {
      await stopLogging();
      setIsActive(false);
    } else {
      // Clear history on new session
      historyRef.current = [];
      setStability(null);
      await startLogging();
      setIsActive(true);
    }
  }, [isActive]);

  const updateConfig = useCallback((newConfig: Partial<LoggingConfig>) => {
    setLoggingConfig(newConfig);
    setConfig(getLoggingConfig());
  }, []);

  return {
    isActive,
    currentSignal,
    stability,
    config,
    toggle,
    updateConfig,
  };
}
