import React, { useState, useEffect, useCallback } from 'react';
import {
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { SignalDisplay } from './src/features/signal-logging/components/SignalDisplay';
import { readSignal, RawSignalReading } from './src/features/signal-logging/services/signal-reader';
import {
  startLogging,
  stopLogging,
  setOnLog,
} from './src/features/signal-logging/services/background-logger';
import { SignalLog } from './src/types/signal';

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    ]);

    return (
      granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted' &&
      granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === 'granted'
    );
  } catch {
    return false;
  }
}

function App() {
  const [permGranted, setPermGranted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentSignal, setCurrentSignal] = useState<RawSignalReading | null>(null);

  // Request permissions on mount
  useEffect(() => {
    requestPermissions().then(setPermGranted);
  }, []);

  // Poll signal every 5s after permissions granted
  useEffect(() => {
    if (!permGranted) return;

    const poll = async () => {
      try {
        const signal = await readSignal();
        setCurrentSignal(signal);
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [permGranted]);

  // Set up background log callback
  useEffect(() => {
    setOnLog((log: SignalLog) => {
      setCurrentSignal({
        carrier: log.carrier,
        networkType: log.networkType,
        signal: log.signal,
        connection: log.connection,
      } as RawSignalReading);
    });
  }, []);

  const toggle = useCallback(async () => {
    if (isActive) {
      await stopLogging();
      setIsActive(false);
    } else {
      if (!permGranted) {
        const granted = await requestPermissions();
        setPermGranted(granted);
        if (!granted) return;
      }
      await startLogging();
      setIsActive(true);
    }
  }, [isActive, permGranted]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Signalog</Text>
        <Text style={styles.subtitle}>Signal Strength Logger</Text>
      </View>

      <View style={styles.content}>
        <SignalDisplay signal={currentSignal} isLogging={isActive} compact={false} />

        <TouchableOpacity
          style={[styles.logToggle, isActive && styles.logToggleActive]}
          onPress={toggle}
        >
          <Text style={styles.logToggleText}>
            {isActive ? 'Stop Logging' : 'Start Logging'}
          </Text>
        </TouchableOpacity>

        {!permGranted && (
          <Text style={styles.permWarning}>
            Location permission required for signal logging
          </Text>
        )}

        <Text style={styles.hint}>
          {isActive
            ? 'Logging signal data in background...'
            : 'Tap "Start Logging" to begin collecting signal data'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#8ec3b9',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logToggle: {
    backgroundColor: '#533483',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  logToggleActive: {
    backgroundColor: '#ef4444',
  },
  logToggleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permWarning: {
    color: '#f97316',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  hint: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
});

export default App;
