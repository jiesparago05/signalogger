import { useState, useCallback } from 'react';
import { api } from '../../../lib/api/client';
import { WorkZone, WorkSpotReview } from '../../../types/signal';

export function useWorkSpots() {
  const [nearbySpots, setNearbySpots] = useState<WorkZone[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNearby = useCallback(async (lng: number, lat: number, radius = 1000) => {
    setLoading(true);
    try {
      const res = await api.workzones.nearby(lng, lat, radius);
      setNearbySpots(res.data);
    } catch (err) {
      console.warn('Failed to fetch nearby work spots:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitReview = useCallback(async (review: Omit<WorkSpotReview, '_id'>) => {
    try {
      return await api.workzones.createReview(review);
    } catch (err) {
      console.warn('Failed to submit review:', err);
      return null;
    }
  }, []);

  return { nearbySpots, loading, fetchNearby, submitReview };
}
