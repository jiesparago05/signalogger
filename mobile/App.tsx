import React, { useState, useEffect } from 'react';
import {
  StatusBar,
  View,
  Text,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MapScreen } from './src/features/map-view/components/MapScreen';
import { cleanupStaleService } from './src/features/signal-logging/services/background-logger';

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
  const [permChecked, setPermChecked] = useState(false);

  useEffect(() => {
    // Clean up any orphaned background service + notification from a prior
    // session that was killed abruptly (force-stopped, OOM killed, etc).
    // Runs before permissions to ensure the stale notification clears ASAP.
    cleanupStaleService().catch(() => {});

    requestPermissions().then((granted) => {
      setPermGranted(granted);
      setPermChecked(true);
    });
  }, []);

  if (!permChecked) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#533483" />
      </View>
    );
  }

  if (!permGranted) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.permWarning}>
          Location permission is required to use Signalog.
        </Text>
        <Text style={styles.permHint}>
          Please grant location access in your device settings.
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <MapScreen />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0a1628',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permWarning: {
    color: '#f97316',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  permHint: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 32,
  },
});

export default App;
