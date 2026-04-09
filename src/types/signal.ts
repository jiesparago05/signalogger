export interface Location {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
  accuracy: number;
  altitude?: number;
}

export type DataState = 'connected' | 'suspended' | 'disconnected' | 'connecting' | 'unknown';

export interface SignalData {
  dbm: number;
  rssi?: number;
  snr?: number;
  cellId?: string;
  bandFrequency?: number;
  // Phase 1 real-connectivity capture — see docs/superpowers/plans/2026-04-10-phase1-*.md
  validated?: boolean;      // Android's NET_CAPABILITY_VALIDATED (probabilistic, not real-time)
  downKbps?: number;        // LinkDownstreamBandwidthKbps estimate (0 = unknown)
  upKbps?: number;          // LinkUpstreamBandwidthKbps estimate (0 = unknown)
  dataState?: DataState;    // TelephonyManager.getDataState()
}

export interface ConnectionData {
  downloadSpeed?: number;
  uploadSpeed?: number;
  ping?: number;
  isWifi: boolean;
}

export interface SignalLog {
  _id?: string;
  sessionId?: string;
  timestamp: Date | string;
  location: Location;
  carrier: string;
  networkType: NetworkType;
  signal: SignalData;
  connection: ConnectionData;
  deviceId: string;
  synced: boolean;
}

export interface ManualReport {
  _id?: string;
  timestamp: Date | string;
  location: { type: 'Point'; coordinates: [number, number] };
  carrier: string;
  networkType: NetworkType;
  category: ReportCategory;
  note?: string;
  attachments: Attachment[];
  deviceId: string;
  synced: boolean;
}

export interface Attachment {
  type: 'photo' | 'voice_note';
  url: string;
  size: number;
}

export interface HeatmapTile {
  _id: string;
  swLng: number;
  swLat: number;
  neLng: number;
  neLat: number;
  zoomLevel: number;
  carrier: string;
  networkType: string;
  avgDbm: number;
  dataPointCount: number;
  lastUpdated: string;
}

export type Carrier = 'Smart' | 'Globe' | 'TNT' | 'GOMO' | 'Sun' | 'DITO';
export type NetworkType = '2G' | '3G' | '4G' | '5G' | 'none';
export type ReportCategory = 'dead_zone' | 'weak_signal' | 'intermittent' | 'slow_data';
export type LoggingMode = 'smart_hybrid' | 'time_only' | 'distance_only';

export interface LoggingConfig {
  mode: LoggingMode;
  stationaryIntervalMs: number;
  movingDistanceM: number;
  batterySaver: boolean;
}

export interface ViewportBounds {
  sw: [number, number]; // [lng, lat]
  ne: [number, number];
}

export interface FilterState {
  carriers: Carrier[];
  networkTypes: NetworkType[];
}

export interface MappingSession {
  _id?: string;
  deviceId: string;
  startTime: Date | string;
  endTime?: Date | string;
  startLocation?: { type: 'Point'; coordinates: [number, number] };
  endLocation?: { type: 'Point'; coordinates: [number, number] };
  startLocationName?: string;
  endLocationName?: string;
  logCount: number;
  avgDbm: number;
  minDbm: number;
  maxDbm: number;
  carrier: string;
  networkType: NetworkType;
  distanceMeters: number;
  stability: 'Stable' | 'Fluctuating' | 'Unstable';
  routeId?: string;
  status: 'active' | 'completed';
  synced: boolean;
}

export interface RouteSegment {
  startLocation: { type: 'Point'; coordinates: [number, number] };
  endLocation: { type: 'Point'; coordinates: [number, number] };
  label: string;
  distanceMeters: number;
  avgDbm: number;
  minDbm: number;
  maxDbm: number;
  sampleCount: number;
  activityLevel: string;
}

export interface CommuteRoute {
  _id?: string;
  deviceId: string;
  name: string;
  sessions: string[];
  segments: RouteSegment[];
  overallGrade: string;
  totalTrips: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface SignalHistoryEntry {
  carrier: string;
  avgDbm: number;
  sampleCount: number;
}

export interface WorkZone {
  _id?: string;
  gridCell: { sw: [number, number]; ne: [number, number] };
  carriers: { carrier: string; avgDbm: number; sampleCount: number; activityLevel: string }[];
  bestCarrier: string;
  bestAvgDbm: number;
}

export interface WorkSpotReview {
  _id?: string;
  location: { type: 'Point'; coordinates: [number, number] };
  deviceId: string;
  carrier: string;
  rating: 'strong' | 'ok' | 'weak' | 'dead';
  comment: string;
  timestamp: Date | string;
  synced: boolean;
}
