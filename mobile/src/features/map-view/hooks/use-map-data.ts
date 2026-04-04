import { useState, useCallback, useRef } from 'react';
import { api } from '../../../lib/api/client';
import { getLocalSignals, getLocalConsolidated, getLocalReadingsByIds } from '../../offline-sync/services/log-store';
import {
  SignalLog,
  ManualReport,
  HeatmapTile,
  ViewportBounds,
  FilterState,
} from '../../../types/signal';

function mergeSignals(local: SignalLog[], server: SignalLog[]): SignalLog[] {
  const map = new Map<string, SignalLog>();
  for (const s of local) map.set(s._id!, s);
  for (const s of server) map.set(s._id!, s);
  return Array.from(map.values());
}

function applyFilters(signals: SignalLog[], filters: FilterState): SignalLog[] {
  return signals.filter((s) => {
    if (filters.carriers.length) {
      const match = filters.carriers.some((c) => c.toLowerCase() === s.carrier.toLowerCase());
      if (!match) return false;
    }
    if (filters.networkTypes.length && !filters.networkTypes.includes(s.networkType as any)) return false;
    return true;
  });
}

export function useMapData() {
  const [signals, setSignals] = useState<SignalLog[]>([]);
  const [consolidated, setConsolidated] = useState<any[]>([]);
  const [reports, setReports] = useState<ManualReport[]>([]);
  const [heatmapTiles, setHeatmapTiles] = useState<HeatmapTile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heatmapCache = useRef<HeatmapTile[]>([]);
  const [breakdownReadings, setBreakdownReadings] = useState<SignalLog[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState(false);
  const readingsCache = useRef<Map<string, SignalLog[]>>(new Map());

  const fetchData = useCallback(
    async (bounds: ViewportBounds, zoom: number, filters: FilterState) => {
      setIsLoading(true);
      setError(null);

      try {
        if (zoom >= 14) {
          // Load local dots first (instant)
          const local = await getLocalSignals(bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]);
          const filtered = applyFilters(local, filters);
          if (filtered.length > 0) {
            setSignals(filtered);
            setHeatmapTiles([]);
          }

          // Load local consolidated (instant)
          const localConsolidated = await getLocalConsolidated(bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]);
          if (localConsolidated.length > 0) {
            setConsolidated(localConsolidated);
          }

          // Fetch server data in background, merge
          Promise.all([
            api.signals.query(bounds, filters),
            api.reports.query(bounds, filters),
          ]).then(([signalRes, reportRes]) => {
            const merged = mergeSignals(filtered, signalRes.data);
            setSignals(merged);
            setConsolidated(signalRes.consolidated || []);
            setReports(reportRes.data);
            setHeatmapTiles([]);
          }).catch(() => {});
        } else {
          // Zoomed out — heatmap (show cache first, refresh from server)
          if (heatmapCache.current.length > 0) {
            setHeatmapTiles(heatmapCache.current);
            setSignals([]);
          }
          api.heatmap.getTiles(bounds, zoom, filters).then((tileRes) => {
            heatmapCache.current = tileRes.data;
            setHeatmapTiles(tileRes.data);
            setSignals([]);
          }).catch(() => {});
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load map data');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const fetchReadings = useCallback(async (consolidatedId: string, readingIds: string[]) => {
    // Check cache first
    const cached = readingsCache.current.get(consolidatedId);
    if (cached) {
      setBreakdownReadings(cached);
      setBreakdownLoading(false);
      setBreakdownError(false);
      return;
    }

    setBreakdownLoading(true);
    setBreakdownError(false);
    setBreakdownReadings([]);

    try {
      let readings: SignalLog[] = [];

      // Try local first (always available)
      readings = await getLocalReadingsByIds(readingIds);

      // If local didn't find enough, try server
      if (readings.length === 0) {
        try {
          const result = await api.signals.fetchReadingsByIds(readingIds);
          readings = result.readings;
        } catch {
          // Server failed — that's ok if we have no local readings either
        }
      }

      if (readings.length === 0) {
        setBreakdownError(true);
      } else {
        const sorted = readings.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        readingsCache.current.set(consolidatedId, sorted);
        setBreakdownReadings(sorted);
      }
    } catch {
      setBreakdownError(true);
    } finally {
      setBreakdownLoading(false);
    }
  }, []);

  const clearBreakdown = useCallback(() => {
    setBreakdownReadings([]);
    setBreakdownLoading(false);
    setBreakdownError(false);
  }, []);

  return {
    signals,
    consolidated,
    reports,
    heatmapTiles,
    isLoading,
    error,
    fetchData,
    breakdownReadings,
    breakdownLoading,
    breakdownError,
    fetchReadings,
    clearBreakdown,
  };
}
