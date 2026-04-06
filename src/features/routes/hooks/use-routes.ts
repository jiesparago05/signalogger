import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../../lib/api/client';
import { getDeviceId } from '../../../lib/config/device';
import { CommuteRoute } from '../../../types/signal';

const ROUTES_KEY = '@signalog_routes';

async function loadLocalRoutes(): Promise<CommuteRoute[]> {
  try {
    const raw = await AsyncStorage.getItem(ROUTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocalRoute(route: CommuteRoute): Promise<void> {
  const routes = await loadLocalRoutes();
  routes.unshift(route);
  await AsyncStorage.setItem(ROUTES_KEY, JSON.stringify(routes.slice(0, 50)));
}

async function updateLocalRoute(routeId: string, updates: Partial<CommuteRoute>): Promise<void> {
  const routes = await loadLocalRoutes();
  const idx = routes.findIndex((r) => r._id === routeId);
  if (idx >= 0) {
    routes[idx] = { ...routes[idx], ...updates };
    await AsyncStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
  }
}

function mergeRoutes(local: CommuteRoute[], server: CommuteRoute[]): CommuteRoute[] {
  const merged = new Map<string, CommuteRoute>();
  // Local first
  for (const r of local) merged.set(r._id, r);
  // Server overrides (has more complete data)
  for (const r of server) merged.set(r._id, r);
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );
}

export function useRoutes() {
  const [routes, setRoutes] = useState<CommuteRoute[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      // Load local first (instant)
      const local = await loadLocalRoutes();
      if (local.length > 0) {
        setRoutes(local);
        setLoading(false);
      }

      // Fetch server in background, merge
      const deviceId = await getDeviceId();
      api.routes.listByDevice(deviceId).then((res) => {
        if (res.data && res.data.length > 0) {
          const merged = mergeRoutes(local, res.data);
          setRoutes(merged);
          // Update local cache with merged data
          AsyncStorage.setItem(ROUTES_KEY, JSON.stringify(merged.slice(0, 50))).catch(() => {});
        }
      }).catch(() => {});
    } catch (err) {
      console.warn('Failed to fetch routes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createRoute = useCallback(async (name: string, sessionId: string) => {
    const deviceId = await getDeviceId();

    // Save locally first (instant)
    const localRoute: CommuteRoute = {
      _id: `local_${Date.now()}`,
      deviceId,
      name,
      sessions: [sessionId],
      segments: [],
      overallGrade: 'N/A',
      totalTrips: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;

    await saveLocalRoute(localRoute);
    setRoutes((prev) => [localRoute, ...prev]);

    // Sync to server in background
    api.routes.create({ deviceId, name, sessions: [sessionId] }).then((serverRoute) => {
      // Update local with server _id
      updateLocalRoute(localRoute._id, { ...serverRoute });
      setRoutes((prev) => prev.map((r) => r._id === localRoute._id ? serverRoute : r));
    }).catch(() => {});

    return localRoute;
  }, []);

  const addSessionToRoute = useCallback(async (routeId: string, sessionId: string) => {
    // Update locally first
    const local = await loadLocalRoutes();
    const route = local.find((r) => r._id === routeId);
    if (route) {
      route.sessions = [...(route.sessions || []), sessionId];
      route.totalTrips = (route.totalTrips || 0) + 1;
      await updateLocalRoute(routeId, { sessions: route.sessions, totalTrips: route.totalTrips });
      setRoutes((prev) => prev.map((r) => r._id === routeId ? route : r));
    }

    // Sync to server in background
    if (!routeId.startsWith('local_')) {
      api.routes.addSession(routeId, sessionId).then((updated) => {
        updateLocalRoute(routeId, updated).catch(() => {});
        setRoutes((prev) => prev.map((r) => r._id === routeId ? updated : r));
      }).catch(() => {});
    }

    return route || null;
  }, []);

  return { routes, loading, fetchRoutes, createRoute, addSessionToRoute };
}
