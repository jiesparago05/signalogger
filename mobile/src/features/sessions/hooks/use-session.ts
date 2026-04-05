import { useState, useCallback, useRef, useEffect } from 'react';
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
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }
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

  // Recover crashed session on app restart
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        if (!raw) return;

        // Clear immediately to prevent duplicate recovery on quick restart
        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);

        const saved = JSON.parse(raw) as MappingSession;

        // Always recover — the background service is dead, session can't resume
        await autoCompleteSession(saved);
      } catch {}
    })();
  }, []);

  // Persist active session whenever it changes
  useEffect(() => {
    if (activeSession) {
      AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(activeSession)).catch(() => {});
    } else {
      AsyncStorage.removeItem(ACTIVE_SESSION_KEY).catch(() => {});
    }
  }, [activeSession]);

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
  }, []);

  const completeSession = useCallback(async () => {
    if (!activeSession) return null;

    const logs = logsRef.current;
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

    try {
      const result = await api.sessions.listByDevice(deviceId);
      if (result.data && result.data.length > 0) {
        return result.data;
      }
    } catch {}

    return loadLocalSessions();
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
    let logs: SignalLog[] = [];

    if (session._id) {
      logs = await getLogsBySessionId(session._id);
    }
    if (logs.length === 0 && session.startTime) {
      logs = await getLogsByTimeRange(new Date(session.startTime), new Date());
    }

    const validLogs = logs.filter(
      (l) => l.timestamp && l.location?.coordinates?.length === 2 && l.signal.dbm > -999
    );

    if (validLogs.length === 0) return;

    const stats = computeSessionStats(validLogs);

    await updateLocalSession(session._id, {
      ...stats,
      status: 'recovered',
    });
  } catch {}
}
