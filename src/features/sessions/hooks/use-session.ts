import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../../lib/api/client';
import { getDeviceId } from '../../../lib/config/device';
import { getCurrentLocation } from '../../signal-logging/services/location-service';
import { getLogsBySessionId, getLogsByTimeRange } from '../../offline-sync/services/log-store';
import { MappingSession, SignalLog } from '../../../types/signal';

const SESSIONS_KEY = '@signalog_sessions';
const ACTIVE_SESSION_KEY = '@signalog_active_session';

async function loadLocalSessions(): Promise<MappingSession[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocalSession(session: MappingSession): Promise<void> {
  const sessions = await loadLocalSessions();
  sessions.unshift(session);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50)));
}

async function updateLocalSession(sessionId: string, updates: Partial<MappingSession>): Promise<void> {
  const sessions = await loadLocalSessions();
  const idx = sessions.findIndex((s) => s._id === sessionId);
  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], ...updates };
  } else {
    // Session not in list (e.g., ID changed by server) — add it
    sessions.unshift({ _id: sessionId, ...updates } as MappingSession);
  }
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50)));
}

function computeSessionStats(logs: SignalLog[]): {
  logCount: number;
  avgDbm: number;
  minDbm: number;
  maxDbm: number;
  distanceMeters: number;
  stability: 'Stable' | 'Fluctuating' | 'Unstable';
  endTime: Date;
  endLocation?: { type: 'Point'; coordinates: [number, number] };
} {
  const validLogs = logs
    .filter((l) => l.timestamp && l.location?.coordinates?.length === 2)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const dbms = validLogs.map((l) => l.signal.dbm).filter((d) => d > -999);
  const avgDbm = dbms.length > 0 ? Math.round(dbms.reduce((s, v) => s + v, 0) / dbms.length) : 0;
  const minDbm = dbms.length > 0 ? Math.min(...dbms) : 0;
  const maxDbm = dbms.length > 0 ? Math.max(...dbms) : 0;
  const range = maxDbm - minDbm;

  let totalDistance = 0;
  for (let i = 1; i < validLogs.length; i++) {
    const prev = validLogs[i - 1].location.coordinates;
    const curr = validLogs[i].location.coordinates;
    const R = 6371000;
    const dLat = ((curr[1] - prev[1]) * Math.PI) / 180;
    const dLng = ((curr[0] - prev[0]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((prev[1] * Math.PI) / 180) *
        Math.cos((curr[1] * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    totalDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const lastLog = validLogs[validLogs.length - 1];

  return {
    logCount: validLogs.length,
    avgDbm,
    minDbm,
    maxDbm,
    distanceMeters: Math.round(totalDistance),
    stability: range <= 10 ? 'Stable' : range <= 25 ? 'Fluctuating' : 'Unstable',
    endTime: lastLog ? new Date(lastLog.timestamp) : new Date(),
    endLocation: lastLog ? { type: 'Point', coordinates: lastLog.location.coordinates } : undefined,
  };
}

export function useSession() {
  const [activeSession, setActiveSession] = useState<MappingSession | null>(null);
  const logsRef = useRef<SignalLog[]>([]);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasInitialized = useRef(false);

  const saveSessionSnapshot = useCallback(() => {
    console.log('[SESSION] saveSnapshot called, activeSession:', !!activeSession, 'logs:', logsRef.current.length);
    if (!activeSession || logsRef.current.length === 0) return;
    const stats = computeSessionStats(logsRef.current);
    const updated = { ...activeSession, ...stats, lastUpdated: new Date().toISOString() };
    AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(updated))
      .then(() => console.log('[SESSION] snapshot saved, id:', activeSession._id, 'logs:', stats.logCount))
      .catch((e) => console.log('[SESSION] snapshot save FAILED:', e));
  }, [activeSession]);

  // Recover crashed session on app restart
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        console.log('[SESSION] recovery check, found key:', !!raw);
        if (raw) {
          const saved = JSON.parse(raw) as MappingSession;
          console.log('[SESSION] recovering session:', saved._id, 'startTime:', saved.startTime, 'logCount:', saved.logCount);

          // Clear immediately to prevent duplicate recovery on quick restart
          await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);

          // Always recover — the background service is dead, session can't resume
          await autoCompleteSession(saved);
          console.log('[SESSION] recovery complete');
        } else {
          console.log('[SESSION] no session to recover');
        }
      } catch (e) {
        console.log('[SESSION] recovery ERROR:', e);
      }
      hasInitialized.current = true;
    })();
  }, []);

  // Persist active session whenever it changes (skip initial null to avoid racing with recovery)
  useEffect(() => {
    if (!hasInitialized.current) return;
    if (activeSession) {
      AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(activeSession)).catch(() => {});
    } else {
      AsyncStorage.removeItem(ACTIVE_SESSION_KEY).catch(() => {});
    }
  }, [activeSession]);

  // Auto-save session stats every 60 seconds
  useEffect(() => {
    if (activeSession) {
      autoSaveRef.current = setInterval(() => {
        saveSessionSnapshot();
      }, 60000);
    } else {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    }
    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    };
  }, [activeSession, saveSessionSnapshot]);

  // Save session on app background (last chance before potential OS kill)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        saveSessionSnapshot();
      }
    });
    return () => subscription.remove();
  }, [saveSessionSnapshot]);

  const startSession = useCallback(async (carrier: string, networkType: string) => {
    try {
      const deviceId = await getDeviceId();

      const session: Partial<MappingSession> = {
        deviceId,
        startTime: new Date(),
        carrier,
        networkType: networkType as any,
        status: 'active',
        logCount: 0,
        avgDbm: 0,
        minDbm: 0,
        maxDbm: 0,
        distanceMeters: 0,
        stability: 'Stable',
        synced: false,
      };

      const created = { ...session, _id: `local_${Date.now()}` } as MappingSession;
      await saveLocalSession(created);
      setActiveSession(created);
      logsRef.current = [];

      getCurrentLocation().then((loc) => {
        created.startLocation = { type: 'Point' as const, coordinates: loc.coordinates };
        updateLocalSession(created._id, { startLocation: created.startLocation }).catch(() => {});
      }).catch(() => {});

      api.sessions.create(session).then((serverSession) => {
        updateLocalSession(created._id, { ...serverSession, _id: serverSession._id });
        setActiveSession(serverSession);
      }).catch(() => {});
    } catch (err) {
      console.warn('Failed to start session:', err);
    }
  }, []);

  const addLog = useCallback((log: SignalLog) => {
    logsRef.current.push(log);
    // Cap at 100 to prevent memory growth — logs are already persisted individually to AsyncStorage
    if (logsRef.current.length > 100) {
      logsRef.current = logsRef.current.slice(-100);
    }
    console.log('[SESSION] addLog #' + logsRef.current.length, 'sessionId:', log.sessionId);
    // Save snapshot on first log (covers short sessions killed before 60s interval)
    if (logsRef.current.length === 1) {
      console.log('[SESSION] first log — triggering snapshot save');
      saveSessionSnapshot();
    }
  }, [saveSessionSnapshot]);

  const completeSession = useCallback(async () => {
    if (!activeSession) return null;

    // Recalculate from AsyncStorage for full accuracy (logsRef is capped at 100)
    let allLogs = await getLogsBySessionId(activeSession._id);
    if (allLogs.length === 0 && activeSession.startTime) {
      allLogs = await getLogsByTimeRange(new Date(activeSession.startTime), new Date());
    }
    // Fallback to logsRef if AsyncStorage is empty
    const logs = allLogs.length > 0 ? allLogs : logsRef.current;
    const stats = computeSessionStats(logs);

    let endLocation = stats.endLocation;
    try {
      const loc = await getCurrentLocation();
      endLocation = { type: 'Point' as const, coordinates: loc.coordinates };
    } catch {}

    const finalStats: Partial<MappingSession> = {
      ...stats,
      endTime: new Date(),
      endLocation,
      status: 'completed',
    };

    const completed = { ...activeSession, ...finalStats };

    await updateLocalSession(activeSession._id, finalStats);

    if (activeSession._id && !activeSession._id.startsWith('local_')) {
      api.sessions.complete(activeSession._id, finalStats).catch(() => {});
    }

    setActiveSession(null);
    logsRef.current = [];
    return completed;
  }, [activeSession]);

  const listSessions = useCallback(async (): Promise<MappingSession[]> => {
    const deviceId = await getDeviceId();
    const local = await loadLocalSessions();

    try {
      const result = await api.sessions.listByDevice(deviceId);
      if (result.data && result.data.length > 0) {
        // Merge: server sessions + local-only sessions (recovered, not yet synced)
        const serverIds = new Set(result.data.map((s: MappingSession) => s._id));
        const localOnly = local.filter((s) => !serverIds.has(s._id) && !s._id?.startsWith('local_'));
        // Also include local_ sessions (never reached server)
        const localUnsynced = local.filter((s) => s._id?.startsWith('local_'));
        return [...localUnsynced, ...localOnly, ...result.data]
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      }
    } catch {}

    return local;
  }, []);

  return {
    activeSession,
    startSession,
    addLog,
    completeSession,
    listSessions,
  };
}

// Auto-complete a crashed session using its logged signals
async function autoCompleteSession(session: MappingSession): Promise<void> {
  try {
    console.log('[SESSION] autoComplete start, id:', session._id, 'startTime:', session.startTime);
    // Collect logs from both sessionId match AND time range (covers ID changes from server sync)
    const logMap = new Map<string, SignalLog>();

    if (session._id) {
      const byId = await getLogsBySessionId(session._id);
      console.log('[SESSION] logs by id:', byId.length);
      byId.forEach((l) => logMap.set(l._id || `${l.timestamp}`, l));
    }
    if (session.startTime) {
      const byTime = await getLogsByTimeRange(new Date(session.startTime), new Date());
      console.log('[SESSION] logs by time:', byTime.length);
      byTime.forEach((l) => logMap.set(l._id || `${l.timestamp}`, l));
    }

    const logs = Array.from(logMap.values());
    console.log('[SESSION] total unique logs:', logs.length);

    const validLogs = logs.filter(
      (l) => l.timestamp && l.location?.coordinates?.length === 2 && l.signal.dbm > -999
    );
    console.log('[SESSION] valid logs:', validLogs.length);

    if (validLogs.length === 0) {
      console.log('[SESSION] no valid logs, discarding');
      return;
    }

    const stats = computeSessionStats(validLogs);
    console.log('[SESSION] stats:', JSON.stringify(stats));

    await updateLocalSession(session._id, {
      ...stats,
      status: 'recovered',
    });
    console.log('[SESSION] updateLocalSession done');
  } catch (e) {
    console.log('[SESSION] autoComplete ERROR:', e);
  }
}
