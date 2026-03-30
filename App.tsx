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

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    // First request foreground location + phone state
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    ]);

    const locationGranted =
      granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted' &&
      granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === 'granted';

    if (!locationGranted) return false;

    // Then request background location separately (Android 10+)
    if (Platform.Version >= 29) {
      const bgResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title: 'Background Location',
          message:
            'Signalog needs background location access to log signal strength while the app is minimized.',
          buttonPositive: 'Allow',
        },
      );
      // Background location is optional — app still works without it
      if (bgResult !== 'granted') {
        console.log('Background location not granted — logging will only work in foreground');
      }
    }

    return true;
  } catch {
    return false;
  }
}

function App() {
  const [permGranted, setPermGranted] = useState(false);
  const [permChecked, setPermChecked] = useState(false);

  useEffect(() => {
    requestPermissions().then((granted) => {
      setPermGranted(granted);
      setPermChecked(true);
    });
  }, []);

  if (!permChecked) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#22C55E" />
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
