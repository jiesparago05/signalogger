import { API_BASE_URL } from '../config';
import {
  SignalLog,
  ManualReport,
  HeatmapTile,
  ViewportBounds,
  FilterState,
  Carrier,
  NetworkType,
  ReportCategory,
  MappingSession,
  CommuteRoute,
  SignalHistoryEntry,
  WorkZone,
  WorkSpotReview,
} from '../../types/signal';

interface ApiResponse<T> {
  data: T;
  count: number;
}

interface CarriersResponse {
  carriers: Carrier[];
  networkTypes: NetworkType[];
  reportCategories: ReportCategory[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  signals: {
    uploadBatch(signals: SignalLog[]): Promise<{ inserted: number }> {
      return request('/signals/batch', {
        method: 'POST',
        body: JSON.stringify(signals),
      });
    },

    query(
      bounds: ViewportBounds,
      filters: FilterState = { carriers: [], networkTypes: [] },
    ): Promise<ApiResponse<SignalLog[]>> {
      const params = new URLSearchParams({
        sw_lng: String(bounds.sw[0]),
        sw_lat: String(bounds.sw[1]),
        ne_lng: String(bounds.ne[0]),
        ne_lat: String(bounds.ne[1]),
      });
      if (filters.carriers.length) params.set('carrier', filters.carriers.join(','));
      if (filters.networkTypes.length) params.set('networkType', filters.networkTypes.join(','));
      return request(`/signals?${params}`);
    },
  },

  heatmap: {
    getTiles(
      bounds: ViewportBounds,
      zoom: number,
      filters: FilterState = { carriers: [], networkTypes: [] },
    ): Promise<ApiResponse<HeatmapTile[]>> {
      const params = new URLSearchParams({
        sw_lng: String(bounds.sw[0]),
        sw_lat: String(bounds.sw[1]),
        ne_lng: String(bounds.ne[0]),
        ne_lat: String(bounds.ne[1]),
        zoom: String(zoom),
      });
      if (filters.carriers.length) params.set('carrier', filters.carriers.join(','));
      if (filters.networkTypes.length) params.set('networkType', filters.networkTypes.join(','));
      return request(`/heatmap/tiles?${params}`);
    },
  },

  reports: {
    create(report: Omit<ManualReport, '_id'>): Promise<ManualReport> {
      return request('/reports', {
        method: 'POST',
        body: JSON.stringify(report),
      });
    },

    query(
      bounds: ViewportBounds,
      filters: FilterState = { carriers: [], networkTypes: [] },
    ): Promise<ApiResponse<ManualReport[]>> {
      const params = new URLSearchParams({
        sw_lng: String(bounds.sw[0]),
        sw_lat: String(bounds.sw[1]),
        ne_lng: String(bounds.ne[0]),
        ne_lat: String(bounds.ne[1]),
      });
      if (filters.carriers.length) params.set('carrier', filters.carriers.join(','));
      if (filters.networkTypes.length) params.set('networkType', filters.networkTypes.join(','));
      return request(`/reports?${params}`);
    },

    async uploadAttachment(reportId: string, filePath: string, mimeType: string): Promise<any> {
      const formData = new FormData();
      formData.append('reportId', reportId);
      formData.append('file', {
        uri: filePath,
        type: mimeType,
        name: filePath.split('/').pop() || 'attachment',
      } as any);

      const url = `${API_BASE_URL}/reports/upload`;
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
      return response.json();
    },
  },

  carriers: {
    list(): Promise<CarriersResponse> {
      return request('/carriers');
    },
  },

  export: {
    getData(deviceId: string, format: 'json' | 'csv' = 'json'): Promise<any> {
      return request(`/export/${deviceId}?format=${format}`);
    },
  },

  sessions: {
    create(data: Partial<MappingSession>): Promise<MappingSession> {
      return request('/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    complete(sessionId: string, stats: Partial<MappingSession>): Promise<MappingSession> {
      return request(`/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify(stats),
      });
    },

    listByDevice(deviceId: string, limit = 20): Promise<{ data: MappingSession[]; count: number }> {
      return request(`/sessions/device/${deviceId}?limit=${limit}`);
    },

    getTrail(sessionId: string): Promise<{ data: SignalLog[]; count: number }> {
      return request(`/sessions/${sessionId}/trail`);
    },
  },

  routes: {
    create(data: { deviceId: string; name: string; sessions: string[] }): Promise<CommuteRoute> {
      return request('/routes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    addSession(routeId: string, sessionId: string): Promise<CommuteRoute> {
      return request(`/routes/${routeId}/add-session`, {
        method: 'PATCH',
        body: JSON.stringify({ sessionId }),
      });
    },

    listByDevice(deviceId: string): Promise<{ data: CommuteRoute[]; count: number }> {
      return request(`/routes/device/${deviceId}`);
    },

    getById(routeId: string): Promise<CommuteRoute> {
      return request(`/routes/${routeId}`);
    },
  },

  history: {
    query(lng: number, lat: number, radius = 500, days = 7, carrier?: string): Promise<{ data: SignalHistoryEntry[]; count: number }> {
      const params = new URLSearchParams({
        lng: String(lng),
        lat: String(lat),
        radius: String(radius),
        days: String(days),
      });
      if (carrier) params.set('carrier', carrier);
      return request(`/history?${params}`);
    },
  },

  workzones: {
    query(bounds: ViewportBounds): Promise<{ data: WorkZone[]; count: number }> {
      const params = new URLSearchParams({
        sw_lng: String(bounds.sw[0]),
        sw_lat: String(bounds.sw[1]),
        ne_lng: String(bounds.ne[0]),
        ne_lat: String(bounds.ne[1]),
      });
      return request(`/workzones?${params}`);
    },

    nearby(lng: number, lat: number, radius = 1000): Promise<{ data: WorkZone[]; count: number }> {
      return request(`/workzones/nearby?lng=${lng}&lat=${lat}&radius=${radius}`);
    },

    createReview(review: Omit<WorkSpotReview, '_id'>): Promise<WorkSpotReview> {
      return request('/workzones/reviews', {
        method: 'POST',
        body: JSON.stringify(review),
      });
    },
  },
};
