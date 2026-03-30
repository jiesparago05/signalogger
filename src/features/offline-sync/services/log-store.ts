import AsyncStorage from '@react-native-async-storage/async-storage';
import { SignalLog, ManualReport } from '../../../types/signal';

const SIGNAL_KEY = '@signalog/signal_queue';
const REPORT_KEY = '@signalog/report_queue';

let signalCache: SignalLog[] | null = null;
let reportCache: ManualReport[] | null = null;

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

export async function addSignalLog(log: SignalLog): Promise<void> {
  const signals = await loadSignals();
  // Generate a local ID for tracking
  const logWithId: SignalLog = {
    ...log,
    _id: log._id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  signals.push(logWithId);
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

// --- Sync interface (used by sync-service) ---

export async function getUnsynced(): Promise<{ signals: SignalLog[]; reports: ManualReport[] }> {
  const signals = await loadSignals();
  const reports = await loadReports();
  return {
    signals: signals.filter((s) => !s.synced),
    reports: reports.filter((r) => !r.synced),
  };
}

export async function markSynced(type: 'signal' | 'report', ids: string[]): Promise<void> {
  if (type === 'signal') {
    const signals = await loadSignals();
    const updated = signals.map((s) =>
      ids.includes(s._id!) ? { ...s, synced: true } : s,
    );
    await saveSignals(updated);
  } else {
    const reports = await loadReports();
    const updated = reports.map((r) =>
      ids.includes(r._id!) ? { ...r, synced: true } : r,
    );
    await saveReports(updated);
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
