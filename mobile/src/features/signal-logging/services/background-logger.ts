import BackgroundService from 'react-native-background-actions';
import { readSignal } from './signal-reader';
import { getCurrentLocation } from './location-service';
import { distanceBetween } from '../../../lib/utils/signal-helpers';
import { getDeviceId } from '../../../lib/config/device';
import { LoggingConfig, SignalLog, Location } from '../../../types/signal';
import { DEFAULT_LOGGING_CONFIG } from '../../../lib/config';

type OnLogCallback = (log: SignalLog) => void;

let isLogging = false;
let config: LoggingConfig = { ...DEFAULT_LOGGING_CONFIG };
let lastLocation: Location | null = null;
let onLog: OnLogCallback | null = null;

export function setLoggingConfig(newConfig: Partial<LoggingConfig>) {
  config = { ...config, ...newConfig };
}

export function getLoggingConfig(): LoggingConfig {
  return { ...config };
}

export function isLoggingActive(): boolean {
  return isLogging;
}

export function setOnLog(callback: OnLogCallback) {
  onLog = callback;
}

async function captureSignalLog(): Promise<SignalLog | null> {
  try {
    const [location, signal, deviceId] = await Promise.all([
      getCurrentLocation(),
      readSignal(),
      getDeviceId(),
    ]);

    const log: SignalLog = {
      timestamp: new Date(),
      location,
      carrier: signal.carrier,
      networkType: signal.networkType,
      signal: signal.signal,
      connection: signal.connection,
      deviceId,
      synced: false,
    };

    return log;
  } catch (error) {
    console.warn('Failed to capture signal log:', error);
    return null;
  }
}

function shouldLogByDistance(currentLocation: Location): boolean {
  if (!lastLocation) return true;

  const distance = distanceBetween(
    lastLocation.coordinates[1],
    lastLocation.coordinates[0],
    currentLocation.coordinates[1],
    currentLocation.coordinates[0],
  );

  return distance >= config.movingDistanceM;
}

async function loggingTask(taskData: any) {
  const { delay } = taskData;

  while (BackgroundService.isRunning()) {
    try {
      const log = await captureSignalLog();

      if (log) {
        const currentLocation = log.location;

        let shouldLog = false;

        if (config.mode === 'time_only') {
          shouldLog = true;
        } else if (config.mode === 'distance_only') {
          shouldLog = shouldLogByDistance(currentLocation);
        } else {
          // smart_hybrid: always log on interval, but also check distance
          shouldLog = true;
          if (lastLocation && !shouldLogByDistance(currentLocation)) {
            // Stationary — still log on interval
            shouldLog = true;
          }
        }

        if (shouldLog) {
          lastLocation = currentLocation;
          onLog?.(log);
        }
      }
    } catch (error) {
      console.warn('Logging cycle error:', error);
    }

    await sleep(delay);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startLogging(): Promise<void> {
  if (isLogging) return;

  try {
    const options = {
      taskName: 'SignalLogging',
      taskTitle: 'Signalog',
      taskDesc: 'Recording signal strength in background',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#22C55E',
      linkingURI: '',
      parameters: {
        delay: config.stationaryIntervalMs,
      },
    };

    await BackgroundService.start(loggingTask, options);
    isLogging = true;
  } catch (error) {
    console.warn('Failed to start background service:', error);
    // Still mark as logging so UI updates, signal reading works without background service
    isLogging = true;
  }
}

export async function stopLogging(): Promise<void> {
  if (!isLogging) return;
  try {
    await BackgroundService.stop();
  } catch (error) {
    console.warn('Failed to stop background service:', error);
  }
  isLogging = false;
  lastLocation = null;
}
