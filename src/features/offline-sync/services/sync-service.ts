import NetInfo from '@react-native-community/netinfo';
import { api } from '../../../lib/api/client';
import { SYNC_CONFIG } from '../../../lib/config';
import { SignalLog, ManualReport } from '../../../types/signal';

type GetUnsyncedFn = () => Promise<{ signals: SignalLog[]; reports: ManualReport[] }>;
type MarkSyncedFn = (type: 'signal' | 'report', ids: string[]) => Promise<void>;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let currentBackoff = SYNC_CONFIG.backoff.initialMs;
let onSyncStatusChange: ((status: SyncStatus) => void) | null = null;

export interface SyncStatus {
  isSyncing: boolean;
  pendingSignals: number;
  pendingReports: number;
  lastSyncAt: Date | null;
  lastError: string | null;
}

let syncStatus: SyncStatus = {
  isSyncing: false,
  pendingSignals: 0,
  pendingReports: 0,
  lastSyncAt: null,
  lastError: null,
};

function updateStatus(updates: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...updates };
  onSyncStatusChange?.(syncStatus);
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function onSyncStatus(callback: (status: SyncStatus) => void) {
  onSyncStatusChange = callback;
}

export async function syncNow(
  getUnsynced: GetUnsyncedFn,
  markSynced: MarkSyncedFn,
): Promise<void> {
  if (isSyncing) return;

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    updateStatus({ lastError: 'No connection' });
    return;
  }

  isSyncing = true;
  updateStatus({ isSyncing: true, lastError: null });

  try {
    const { signals, reports } = await getUnsynced();
    console.log(`[Sync] Found ${signals.length} signals, ${reports.length} reports to sync`);
    updateStatus({ pendingSignals: signals.length, pendingReports: reports.length });

    // Sync signal logs in batches
    for (let i = 0; i < signals.length; i += SYNC_CONFIG.maxBatchSize) {
      const batch = signals.slice(i, i + SYNC_CONFIG.maxBatchSize);
      // Strip local _id — let MongoDB generate its own
      const cleanBatch = batch.map(({ _id, synced, ...rest }) => rest);
      await api.signals.uploadBatch(cleanBatch as any);
      const ids = batch.map((s) => s._id!).filter(Boolean);
      await markSynced('signal', ids);
      updateStatus({ pendingSignals: signals.length - (i + batch.length) });
    }

    // Sync reports one by one (they may have attachments)
    for (const report of reports) {
      const created = await api.reports.create(report);

      // Upload attachments if any
      for (const attachment of report.attachments) {
        if (attachment.url.startsWith('file://') || attachment.url.startsWith('/')) {
          const mimeType = attachment.type === 'photo' ? 'image/jpeg' : 'audio/m4a';
          await api.reports.uploadAttachment(created._id!, attachment.url, mimeType);
        }
      }

      await markSynced('report', [report._id!]);
      updateStatus({ pendingReports: syncStatus.pendingReports - 1 });
    }

    currentBackoff = SYNC_CONFIG.backoff.initialMs;
    updateStatus({
      isSyncing: false,
      lastSyncAt: new Date(),
      pendingSignals: 0,
      pendingReports: 0,
    });
  } catch (error: any) {
    currentBackoff = Math.min(
      currentBackoff * SYNC_CONFIG.backoff.multiplier,
      SYNC_CONFIG.backoff.maxMs,
    );
    updateStatus({
      isSyncing: false,
      lastError: error.message || 'Sync failed',
    });

    // Retry with backoff
    syncTimer = setTimeout(() => syncNow(getUnsynced, markSynced), currentBackoff);
  } finally {
    isSyncing = false;
  }
}

export function startPeriodicSync(
  getUnsynced: GetUnsyncedFn,
  markSynced: MarkSyncedFn,
): void {
  stopPeriodicSync();

  // Sync immediately
  syncNow(getUnsynced, markSynced);

  // Then every SYNC_CONFIG.syncIntervalMs
  syncTimer = setInterval(
    () => syncNow(getUnsynced, markSynced),
    SYNC_CONFIG.syncIntervalMs,
  );

  // Also sync when connectivity changes from offline → online
  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncNow(getUnsynced, markSynced);
    }
  });
}

export function stopPeriodicSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}
