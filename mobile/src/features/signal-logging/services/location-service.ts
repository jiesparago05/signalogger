import Geolocation from '@react-native-community/geolocation';
import { Location } from '../../../types/signal';

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: 'playServices',
});

function toLocation(position: any): Location {
  return {
    type: 'Point',
    coordinates: [position.coords.longitude, position.coords.latitude],
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude ?? undefined,
  };
}

let lastKnownLocation: Location | null = null;

export function getCurrentLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      // Return last known location if available
      if (lastKnownLocation) {
        resolve(lastKnownLocation);
      } else {
        reject(new Error('Location request timed out'));
      }
    }, 15000);

    try {
      Geolocation.getCurrentPosition(
        (position) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          lastKnownLocation = toLocation(position);
          resolve(lastKnownLocation);
        },
        (error) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          // Return last known location on error
          if (lastKnownLocation) {
            resolve(lastKnownLocation);
          } else {
            reject(new Error(`Location error: ${error.message}`));
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000,
        },
      );
    } catch (err) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      if (lastKnownLocation) {
        resolve(lastKnownLocation);
      } else {
        reject(new Error('Location unavailable'));
      }
    }
  });
}

export function watchLocation(
  onLocation: (location: Location) => void,
  onError?: (error: Error) => void,
): number {
  return Geolocation.watchPosition(
    (position) => {
      lastKnownLocation = toLocation(position);
      onLocation(lastKnownLocation);
    },
    (error) => onError?.(new Error(error.message)),
    {
      enableHighAccuracy: false,
      distanceFilter: 10,
      interval: 5000,
      fastestInterval: 2000,
    },
  );
}

export function clearWatch(watchId: number): void {
  try {
    Geolocation.stopObserving();
  } catch {}
}
