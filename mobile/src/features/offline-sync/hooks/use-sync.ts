import { useEffect, useState, useCallback } from 'react';
import {
  startPeriodicSync,
  stopPeriodicSync,
  getSyncStatus,
  onSyncStatus,
  SyncStatus,
} from '../services/sync-service';
import { getUnsynced, markSynced, cleanupSynced } from '../services/log-store';

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => {
    // Listen for status updates
    onSyncStatus(setStatus);

    // Start periodic sync with store callbacks
    startPeriodicSync(getUnsynced, markSynced);

    // Cleanup old synced items on mount
    cleanupSynced().catch(() => {});

    return () => {
      stopPeriodicSync();
    };
  }, []);

  const syncNowManual = useCallback(async () => {
    const { syncNow } = await import('../services/sync-service');
    await syncNow(getUnsynced, markSynced);
  }, []);

  return {
    status,
    syncNow: syncNowManual,
  };
}
