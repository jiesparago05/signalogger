import Geolocation from '@react-native-community/geolocation';
import { Location } from '../../../types/signal';

export function getCurrentLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          type: 'Point',
          coordinates: [position.coords.longitude, position.coords.latitude],
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? undefined,
        });
      },
      (error) => reject(new Error(`Location error: ${error.message}`)),
      {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 30000,
      },
    );
  });
}

export function watchLocation(
  onLocation: (location: Location) => void,
  onError?: (error: Error) => void,
): number {
  return Geolocation.watchPosition(
    (position) => {
      onLocation({
        type: 'Point',
        coordinates: [position.coords.longitude, position.coords.latitude],
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude ?? undefined,
      });
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
  Geolocation.clearWatch(watchId);
}
