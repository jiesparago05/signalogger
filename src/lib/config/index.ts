import { LoggingConfig, Carrier, NetworkType, ReportCategory } from '../../types/signal';

export const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000/api' // Android emulator → host machine
  : 'https://api.signalog.app/api'; // production (placeholder)

export const CARRIERS: Carrier[] = ['Smart', 'Globe', 'TNT', 'GOMO', 'Sun', 'DITO'];

export const NETWORK_TYPES: NetworkType[] = ['2G', '3G', '4G', '5G', 'none'];

export const REPORT_CATEGORIES: ReportCategory[] = [
  'dead_zone',
  'weak_signal',
  'intermittent',
  'slow_data',
];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  dead_zone: 'Dead Zone',
  weak_signal: 'Weak Signal',
  intermittent: 'Intermittent',
  slow_data: 'Slow Data',
};

export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  mode: 'smart_hybrid',
  stationaryIntervalMs: 30000, // 30 seconds
  movingDistanceM: 50, // 50 meters
  batterySaver: true,
};

export const SYNC_CONFIG = {
  maxBatchSize: 100,
  syncIntervalMs: 300000, // 5 minutes
  backoff: {
    initialMs: 1000,
    maxMs: 60000,
    multiplier: 2,
  },
};

export const SIGNAL_STRENGTH = {
  excellent: -65,
  good: -75,
  moderate: -85,
  weak: -95,
  // anything below -95 is dead/no signal
};

export const SIGNAL_COLORS = {
  excellent: '#22c55e', // green
  good: '#84cc16', // lime
  moderate: '#eab308', // yellow
  weak: '#f97316', // orange
  dead: '#ef4444', // red
};

export function getSignalLevel(dbm: number): keyof typeof SIGNAL_STRENGTH {
  if (dbm >= SIGNAL_STRENGTH.excellent) return 'excellent';
  if (dbm >= SIGNAL_STRENGTH.good) return 'good';
  if (dbm >= SIGNAL_STRENGTH.moderate) return 'moderate';
  if (dbm >= SIGNAL_STRENGTH.weak) return 'weak';
  return 'dead' as any;
}

export function getSignalColor(dbm: number): string {
  const level = getSignalLevel(dbm);
  return SIGNAL_COLORS[level] || SIGNAL_COLORS.dead;
}
