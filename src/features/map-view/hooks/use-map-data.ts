import { useState, useCallback } from 'react';
import { api } from '../../../lib/api/client';
import {
  SignalLog,
  ManualReport,
  HeatmapTile,
  ViewportBounds,
  FilterState,
} from '../../../types/signal';

export function useMapData() {
  const [signals, setSignals] = useState<SignalLog[]>([]);
  const [reports, setReports] = useState<ManualReport[]>([]);
  const [heatmapTiles, setHeatmapTiles] = useState<HeatmapTile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (bounds: ViewportBounds, zoom: number, filters: FilterState) => {
      setIsLoading(true);
      setError(null);

      try {
        if (zoom >= 14) {
          // Zoomed in — show individual pins
          const [signalRes, reportRes] = await Promise.all([
            api.signals.query(bounds, filters),
            api.reports.query(bounds, filters),
          ]);
          setSignals(signalRes.data);
          setReports(reportRes.data);
          setHeatmapTiles([]);
        } else {
          // Zoomed out — show heatmap
          const tileRes = await api.heatmap.getTiles(bounds, zoom, filters);
          setHeatmapTiles(tileRes.data);
          setSignals([]);
          setReports([]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load map data');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    signals,
    reports,
    heatmapTiles,
    isLoading,
    error,
    fetchData,
  };
}
