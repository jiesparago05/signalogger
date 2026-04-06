import AsyncStorage from '@react-native-async-storage/async-storage';
import { SignalLog, ManualReport, WorkSpotReview } from '../../../types/signal';

const SIGNAL_KEY = '@signalog/signal_queue';
const REPORT_KEY = '@signalog/report_queue';
const REVIEW_KEY = '@signalog/review_queue';

let signalCache: SignalLog[] | null = null;
let reportCache: ManualReport[] | null = null;
let reviewCache: WorkSpotReview[] | null = null;

// --- Signal logs ---

async function loadSignals(): Promise<SignalLog[]> {
  if (signalCache) return signalCache;
  const raw = await AsyncStorage.getItem(SIGNAL_KEY);
  signalCache = raw ? JSON.parse(raw) : [];
  return signalCache!;
}

async function saveSignals(signals: SignalLog[]): Promise<void> {
  signalCache = signals;
  await AsyncStorage.setItem(SIGNAL_KEY, JSON.stringify(signals));
}

const SIGNAL_CACHE_MAX = 500;

export async function addSignalLog(log: SignalLog): Promise<void> {
  const signals = await loadSignals();
  // Generate a local ID for tracking
  const logWithId: SignalLog = {
    ...log,
    _id: log._id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  signals.push(logWithId);
  // Cap in-memory cache to prevent unbounded growth during long sessions
  while (signals.length > SIGNAL_CACHE_MAX) {
    signals.shift();
  }
  await saveSignals(signals);
}

export async function getSignalCount(): Promise<number> {
  const signals = await loadSignals();
  return signals.filter((s) => !s.synced).length;
}

// --- Manual reports ---

async function loadReports(): Promise<ManualReport[]> {
  if (reportCache) return reportCache;
  const raw = await AsyncStorage.getItem(REPORT_KEY);
  reportCache = raw ? JSON.parse(raw) : [];
  return reportCache!;
}

async function saveReports(reports: ManualReport[]): Promise<void> {
  reportCache = reports;
  await AsyncStorage.setItem(REPORT_KEY, JSON.stringify(reports));
}

export async function addReport(report: ManualReport): Promise<void> {
  const reports = await loadReports();
  const reportWithId: ManualReport = {
    ...report,
    _id: report._id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  reports.push(reportWithId);
  await saveReports(reports);
}

// --- Work spot reviews ---

async function loadReviews(): Promise<WorkSpotReview[]> {
  if (reviewCache) return reviewCache;
  const raw = await AsyncStorage.getItem(REVIEW_KEY);
  reviewCache = raw ? JSON.parse(raw) : [];
  return reviewCache!;
}

async function saveReviews(reviews: WorkSpotReview[]): Promise<void> {
  reviewCache = reviews;
  await AsyncStorage.setItem(REVIEW_KEY, JSON.stringify(reviews));
}

export async function addReview(review: WorkSpotReview): Promise<void> {
  const reviews = await loadReviews();
  const reviewWithId: WorkSpotReview = {
    ...review,
    _id: review._id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  reviews.push(reviewWithId);
  await saveReviews(reviews);
}

// --- Local query (for local-first map display) ---

export async function getLocalSignals(swLng: number, swLat: number, neLng: number, neLat: number): Promise<SignalLog[]> {
  const signals = await loadSignals();
  return signals.filter((s) => {
    if (!s.location?.coordinates) return false;
    const [lng, lat] = s.location.coordinates;
    return lng >= swLng && lng <= neLng && lat >= swLat && lat <= neLat;
  });
}

export async function getLogsByTimeRange(startTime: Date, endTime: Date): Promise<SignalLog[]> {
  const signals = await loadSignals();
  const start = startTime.getTime();
  const end = endTime.getTime();
  return signals.filter((s) => {
    const t = new Date(s.timestamp).getTime();
    return t >= start && t <= end;
  });
}

export async function getLogsBySessionId(sessionId: string): Promise<SignalLog[]> {
  const signals = await loadSignals();
  return signals.filter((s) => s.sessionId === sessionId);
}

export async function getLocalReadingsByIds(ids: string[]): Promise<SignalLog[]> {
  const signals = await loadSignals();
  const idSet = new Set(ids);
  return signals.filter((s) => s._id && idSet.has(s._id));
}

// --- Local consolidation (offline support) ---

export interface LocalConsolidated {
  _id?: string;
  location: { type: 'Point'; coordinates: [number, number] };
  carrier: string;
  networkType: string;
  avgDbm: number;
  minDbm: number;
  maxDbm: number;
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
  readingIds?: string[];
}

export async function getLocalConsolidated(swLng: number, swLat: number, neLng: number, neLat: number): Promise<LocalConsolidated[]> {
  const signals = await loadSignals();
  const CELL = 0.0005;

  const groups = new Map<string, { ids: string[]; lngs: number[]; lats: number[]; dbms: number[]; timestamps: number[]; carrier: string; networkType: string }>();

  for (const s of signals) {
    if (!s.location?.coordinates) continue;
    const [lng, lat] = s.location.coordinates;
    if (lng < swLng || lng > neLng || lat < swLat || lat > neLat) continue;
    if (s.connection?.isWifi) continue;

    const cellLng = Math.round(lng / CELL) * CELL;
    const cellLat = Math.round(lat / CELL) * CELL;
    const key = `${cellLng.toFixed(4)}_${cellLat.toFixed(4)}_${s.carrier}_${s.networkType}`;

    if (!groups.has(key)) {
      groups.set(key, { ids: [], lngs: [], lats: [], dbms: [], timestamps: [], carrier: s.carrier, networkType: s.networkType });
    }
    const g = groups.get(key)!;
    if (s._id) g.ids.push(s._id);
    g.lngs.push(lng);
    g.lats.push(lat);
    g.dbms.push(s.signal.dbm);
    g.timestamps.push(new Date(s.timestamp).getTime());
  }

  const result: LocalConsolidated[] = [];
  for (const [key, g] of groups.entries()) {
    if (g.dbms.length < 2) continue;
    const avgLng = g.lngs.reduce((a, b) => a + b, 0) / g.lngs.length;
    const avgLat = g.lats.reduce((a, b) => a + b, 0) / g.lats.length;
    result.push({
      _id: `local_${key}`,
      location: { type: 'Point', coordinates: [avgLng, avgLat] },
      carrier: g.carrier,
      networkType: g.networkType,
      avgDbm: Math.round(g.dbms.reduce((a, b) => a + b, 0) / g.dbms.length),
      minDbm: Math.min(...g.dbms),
      maxDbm: Math.max(...g.dbms),
      count: g.dbms.length,
      firstTimestamp: new Date(Math.min(...g.timestamps)).toISOString(),
      lastTimestamp: new Date(Math.max(...g.timestamps)).toISOString(),
      readingIds: g.ids.slice(0, 100),
    });
  }
  return result;
}

// --- Sync interface (used by sync-service) ---

export async function getUnsynced(): Promise<{ signals: SignalLog[]; reports: ManualReport[]; reviews: WorkSpotReview[] }> {
  const signals = await loadSignals();
  const reports = await loadReports();
  const reviews = await loadReviews();
  return {
    signals: signals.filter((s) => !s.synced),
    reports: reports.filter((r) => !r.synced),
    reviews: reviews.filter((r) => !r.synced),
  };
}

export async function markSynced(type: 'signal' | 'report' | 'review', ids: string[]): Promise<void> {
  if (type === 'signal') {
    const signals = await loadSignals();
    const updated = signals.map((s) =>
      ids.includes(s._id!) ? { ...s, synced: true } : s,
    );
    await saveSignals(updated);
  } else if (type === 'report') {
    const reports = await loadReports();
    const updated = reports.map((r) =>
      ids.includes(r._id!) ? { ...r, synced: true } : r,
    );
    await saveReports(updated);
  } else {
    const reviews = await loadReviews();
    const updated = reviews.map((r) =>
      ids.includes(r._id!) ? { ...r, synced: true } : r,
    );
    await saveReviews(updated);
  }
}

// --- Cleanup (remove synced items older than 24h) ---

export async function cleanupSynced(): Promise<void> {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  const signals = await loadSignals();
  const filteredSignals = signals.filter(
    (s) => !s.synced || new Date(s.timestamp).getTime() > cutoff,
  );
  await saveSignals(filteredSignals);

  const reports = await loadReports();
  const filteredReports = reports.filter(
    (r) => !r.synced || new Date(r.timestamp).getTime() > cutoff,
  );
  await saveReports(filteredReports);
}
