import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { FilterChips } from './FilterChips';
import { SignalDisplay } from '../../signal-logging/components/SignalDisplay';
import { ReportModal } from '../../manual-report/components/ReportModal';
import { useMapData } from '../hooks/use-map-data';
import { useFilters } from '../hooks/use-filters';
import { useSignalLogger } from '../../signal-logging/hooks/use-signal-logger';
import { getSignalColor } from '../../../lib/config';
import { ViewportBounds, SignalLog } from '../../../types/signal';

// Manila default center
const DEFAULT_CENTER: [number, number] = [121.0, 14.55];
const DEFAULT_ZOOM = 12;

export function MapScreen() {
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [reportVisible, setReportVisible] = useState(false);

  const { filters, toggleCarrier, toggleNetworkType } = useFilters();
  const { signals, reports, heatmapTiles, fetchData } = useMapData();

  const handleNewLog = useCallback((log: SignalLog) => {
    // Store locally (WatermelonDB integration will go here)
    console.log('New signal log:', log.signal.dbm, log.carrier);
  }, []);

  const { isActive, currentSignal, toggle } = useSignalLogger(handleNewLog);

  const handleRegionChange = useCallback(
    async (feature: any) => {
      const { geometry, properties } = feature;
      if (!geometry || !properties) return;

      const currentZoom = properties.zoomLevel || DEFAULT_ZOOM;
      setZoom(currentZoom);

      const bounds = properties.visibleBounds;
      if (bounds) {
        const viewport: ViewportBounds = {
          sw: [bounds[1][0], bounds[1][1]],
          ne: [bounds[0][0], bounds[0][1]],
        };
        fetchData(viewport, Math.round(currentZoom), filters);
      }
    },
    [fetchData, filters],
  );

  const handleReportSubmit = useCallback(
    (data: any) => {
      console.log('Report submitted:', data);
      // WatermelonDB storage + sync will go here
    },
    [],
  );

  // Build heatmap GeoJSON from tiles
  const heatmapGeoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: heatmapTiles.map((tile) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [(tile.swLng + tile.neLng) / 2, (tile.swLat + tile.neLat) / 2],
      },
      properties: {
        avgDbm: tile.avgDbm,
        count: tile.dataPointCount,
        weight: Math.max(0, (tile.avgDbm + 120) / 60), // normalize -120...-60 → 0...1
      },
    })),
  };

  // Build pins GeoJSON from individual signals
  const pinsGeoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: signals.map((sig) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: sig.location.coordinates,
      },
      properties: {
        dbm: sig.signal.dbm,
        carrier: sig.carrier,
        networkType: sig.networkType,
        color: getSignalColor(sig.signal.dbm),
      },
    })),
  };

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark}
        onRegionDidChange={handleRegionChange}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: DEFAULT_CENTER,
            zoomLevel: DEFAULT_ZOOM,
          }}
        />

        {/* Heatmap layer (zoomed out) */}
        {heatmapTiles.length > 0 && (
          <MapboxGL.ShapeSource id="heatmap-source" shape={heatmapGeoJson}>
            <MapboxGL.HeatmapLayer
              id="heatmap-layer"
              style={{
                heatmapWeight: ['get', 'weight'],
                heatmapIntensity: 1,
                heatmapRadius: 30,
                heatmapColor: [
                  'interpolate',
                  ['linear'],
                  ['heatmap-density'],
                  0, 'rgba(0,0,0,0)',
                  0.2, '#ef4444',
                  0.4, '#f97316',
                  0.6, '#eab308',
                  0.8, '#84cc16',
                  1, '#22c55e',
                ],
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Pin markers (zoomed in) */}
        {signals.length > 0 && (
          <MapboxGL.ShapeSource id="pins-source" shape={pinsGeoJson}>
            <MapboxGL.CircleLayer
              id="pins-layer"
              style={{
                circleRadius: 6,
                circleColor: ['get', 'color'],
                circleStrokeWidth: 1,
                circleStrokeColor: '#fff',
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {/* Filter chips */}
      <FilterChips
        filters={filters}
        onToggleCarrier={toggleCarrier}
        onToggleNetworkType={toggleNetworkType}
      />

      {/* FAB for report */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setReportVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Bottom sheet (collapsed) */}
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        <SignalDisplay signal={currentSignal} isLogging={isActive} compact />
        <TouchableOpacity style={styles.logToggle} onPress={toggle}>
          <Text style={styles.logToggleText}>
            {isActive ? 'Stop Logging' : 'Start Logging'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Report modal */}
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportSubmit}
        currentCarrier={currentSignal?.carrier || 'Unknown'}
        currentNetworkType={currentSignal?.networkType || 'none'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 140,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#533483',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 30,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#16213e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  logToggle: {
    backgroundColor: '#0f3460',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  logToggleText: {
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: '600',
  },
});
