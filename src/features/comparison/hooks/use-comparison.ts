import { useState, useCallback } from 'react';
import { api } from '../../../lib/api/client';

interface CarrierRanking {
  carrier: string;
  avgDbm: number;
  activityLevel: string;
  sampleCount: number;
}

interface SegmentComparison {
  label: string;
  distanceMeters: number;
  carriers: { carrier: string; avgDbm: number; activityLevel: string }[];
}

interface RouteComparisonData {
  ranking: CarrierRanking[];
  segments: SegmentComparison[];
  totalDataPoints: number;
}

export function useComparison() {
  const [routeData, setRouteData] = useState<RouteComparisonData | null>(null);
  const [locationData, setLocationData] = useState<CarrierRanking[]>([]);
  const [loading, setLoading] = useState(false);

  const compareRoute = useCallback(async (routeId: string) => {
    setLoading(true);
    try {
      const result = await api.compare.route(routeId);
      setRouteData(result);
      return result;
    } catch (err) {
      console.warn('Route comparison failed:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const compareLocation = useCallback(async (lng: number, lat: number) => {
    setLoading(true);
    try {
      const result = await api.compare.location(lng, lat);
      setLocationData(result.data);
      return result.data;
    } catch (err) {
      console.warn('Location comparison failed:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { routeData, locationData, loading, compareRoute, compareLocation };
}
