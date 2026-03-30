import { useState, useEffect, useCallback } from 'react';
import {
  startLogging,
  stopLogging,
  isLoggingActive,
  setOnLog,
  setLoggingConfig,
  getLoggingConfig,
} from '../services/background-logger';
import { readSignal, RawSignalReading } from '../services/signal-reader';
import { SignalLog, LoggingConfig } from '../../../types/signal';

export function useSignalLogger(onNewLog?: (log: SignalLog) => void) {
  const [isActive, setIsActive] = useState(isLoggingActive());
  const [currentSignal, setCurrentSignal] = useState<RawSignalReading | null>(null);
  const [config, setConfig] = useState<LoggingConfig>(getLoggingConfig());

  useEffect(() => {
    setOnLog((log: SignalLog) => {
      setCurrentSignal({
        carrier: log.carrier,
        networkType: log.networkType,
        signal: log.signal,
        connection: log.connection,
      });
      onNewLog?.(log);
    });
  }, [onNewLog]);

  // Poll current signal for display (every 5s)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const signal = await readSignal();
        setCurrentSignal(signal);
      } catch {}
    }, 5000);

    // Read immediately
    readSignal().then(setCurrentSignal).catch(() => {});

    return () => clearInterval(interval);
  }, []);

  const toggle = useCallback(async () => {
    if (isActive) {
      await stopLogging();
      setIsActive(false);
    } else {
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
    config,
    toggle,
    updateConfig,
  };
}
