export interface Location {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
  accuracy: number;
  altitude?: number;
}

export interface SignalData {
  dbm: number;
  rssi?: number;
  snr?: number;
  cellId?: string;
  bandFrequency?: number;
}

export interface ConnectionData {
  downloadSpeed?: number;
  uploadSpeed?: number;
  ping?: number;
  isWifi: boolean;
}

export interface SignalLog {
  _id?: string;
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
