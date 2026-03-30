import { useState, useCallback } from 'react';
import { api } from '../../../lib/api/client';
import { getDeviceId } from '../../../lib/config/device';
import { CommuteRoute } from '../../../types/signal';

export function useRoutes() {
  const [routes, setRoutes] = useState<CommuteRoute[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const res = await api.routes.listByDevice(deviceId);
      setRoutes(res.data);
    } catch (err) {
      console.warn('Failed to fetch routes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createRoute = useCallback(async (name: string, sessionId: string) => {
    try {
      const deviceId = await getDeviceId();
      const route = await api.routes.create({ deviceId, name, sessions: [sessionId] });
      setRoutes((prev) => [route, ...prev]);
      return route;
    } catch (err) {
      console.warn('Failed to create route:', err);
      return null;
    }
  }, []);

  const addSessionToRoute = useCallback(async (routeId: string, sessionId: string) => {
    try {
      const updated = await api.routes.addSession(routeId, sessionId);
      setRoutes((prev) => prev.map((r) => (r._id === routeId ? updated : r)));
      return updated;
    } catch (err) {
      console.warn('Failed to add session to route:', err);
      return null;
    }
  }, []);

  return { routes, loading, fetchRoutes, createRoute, addSessionToRoute };
}
