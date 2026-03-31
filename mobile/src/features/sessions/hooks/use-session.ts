import { useState, useCallback, useRef } from 'react';
import { api } from '../../../lib/api/client';
import { getDeviceId } from '../../../lib/config/device';
import { getCurrentLocation } from '../../signal-logging/services/location-service';
import { MappingSession, SignalLog } from '../../../types/signal';

export function useSession() {
  const [activeSession, setActiveSession] = useState<MappingSession | null>(null);
  const logsRef = useRef<SignalLog[]>([]);

  const startSession = useCallback(async (carrier: string, networkType: string) => {
    try {
      const deviceId = await getDeviceId();
      let startLocation;
      try {
        const loc = await getCurrentLocation();
        startLocation = { type: 'Point' as const, coordinates: loc.coordinates };
      } catch {}

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

      if (startLocation) session.startLocation = startLocation;

      try {
        const created = await api.sessions.create(session);
        setActiveSession(created);
      } catch {
        const localSession = { ...session, _id: `local_${Date.now()}` } as MappingSession;
        setActiveSession(localSession);
      }

      logsRef.current = [];
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
    const dbms = logs.map((l) => l.signal.dbm).filter((d) => d > -999);

    let endLocation;
    try {
      const loc = await getCurrentLocation();
      endLocation = { type: 'Point' as const, coordinates: loc.coordinates };
    } catch {}

    let totalDistance = 0;
    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1].location.coordinates;
      const curr = logs[i].location.coordinates;
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

    const avgDbm = dbms.length > 0 ? Math.round(dbms.reduce((s, v) => s + v, 0) / dbms.length) : 0;
    const minDbm = dbms.length > 0 ? Math.min(...dbms) : 0;
    const maxDbm = dbms.length > 0 ? Math.max(...dbms) : 0;
    const range = maxDbm - minDbm;
    const stability = range <= 10 ? 'Stable' : range <= 25 ? 'Fluctuating' : 'Unstable';

    const stats: Partial<MappingSession> = {
      endTime: new Date(),
      endLocation,
      logCount: logs.length,
      avgDbm,
      minDbm,
      maxDbm,
      distanceMeters: Math.round(totalDistance),
      stability: stability as MappingSession['stability'],
    };

    try {
      if (activeSession._id && !activeSession._id.startsWith('local_')) {
        await api.sessions.complete(activeSession._id, stats);
      }
    } catch {
      console.warn('Failed to complete session on server');
    }

    const completed = { ...activeSession, ...stats, status: 'completed' as const };
    setActiveSession(null);
    logsRef.current = [];
    return completed;
  }, [activeSession]);

  return {
    activeSession,
    startSession,
    addLog,
    completeSession,
  };
}
