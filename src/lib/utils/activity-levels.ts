// src/lib/utils/activity-levels.ts

export type ActivityLevel = 'gaming' | 'streaming' | 'browsing' | 'messaging' | 'dead';

export interface ActivityInfo {
  level: ActivityLevel;
  label: string;
  color: string;
}

const ACTIVITY_THRESHOLDS: { min: number; info: ActivityInfo }[] = [
  { min: -75, info: { level: 'gaming', label: 'Gaming + Streaming + Browse', color: '#22C55E' } },
  { min: -85, info: { level: 'streaming', label: 'Streaming + Browse', color: '#84CC16' } },
  { min: -95, info: { level: 'browsing', label: 'Browse + Messaging', color: '#EAB308' } },
  { min: -105, info: { level: 'messaging', label: 'Messaging Only (slow)', color: '#F97316' } },
];

const DEAD_ACTIVITY: ActivityInfo = { level: 'dead', label: 'No Data — Dead Zone', color: '#EF4444' };

export function getActivityLevel(avgDbm: number): ActivityInfo {
  for (const threshold of ACTIVITY_THRESHOLDS) {
    if (avgDbm >= threshold.min) return threshold.info;
  }
  return DEAD_ACTIVITY;
}

export function getRouteGrade(segments: { avgDbm: number }[]): string {
  if (segments.length === 0) return 'N/A';
  const avg = segments.reduce((sum, s) => sum + s.avgDbm, 0) / segments.length;
  if (avg >= -70) return 'A';
  if (avg >= -80) return 'B';
  if (avg >= -90) return 'C';
  if (avg >= -100) return 'D';
  return 'F';
}
