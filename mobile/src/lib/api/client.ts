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
};
