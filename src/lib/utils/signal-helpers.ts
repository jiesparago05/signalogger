import { getSignalLevel } from '../config';

export function formatDbm(dbm: number): string {
  return `${dbm} dBm`;
}

export function formatSpeed(mbps: number | undefined): string {
  if (mbps === undefined || mbps === null) return '--';
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(1)} Gbps`;
  return `${mbps.toFixed(1)} Mbps`;
}

export function formatPing(ms: number | undefined): string {
  if (ms === undefined || ms === null) return '--';
  return `${Math.round(ms)}ms`;
}

export function signalLevelLabel(dbm: number): string {
  const level = getSignalLevel(dbm);
  const labels: Record<string, string> = {
    excellent: 'Excellent',
    good: 'Good',
    moderate: 'Moderate',
    weak: 'Weak',
    dead: 'Very Weak',
  };
  return labels[level] || 'Unknown';
}

export function distanceBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
