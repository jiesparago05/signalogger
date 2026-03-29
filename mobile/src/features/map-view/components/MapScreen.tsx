import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { Circle, Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { FilterChips } from './FilterChips';
import { SignalDisplay } from '../../signal-logging/components/SignalDisplay';
import { ReportModal } from '../../manual-report/components/ReportModal';
import { useMapData } from '../hooks/use-map-data';
import { useFilters } from '../hooks/use-filters';
import { useSignalLogger } from '../../signal-logging/hooks/use-signal-logger';
import { getSignalColor } from '../../../lib/config';
import { ViewportBounds, SignalLog } from '../../../types/signal';

// Manila default center
const DEFAULT_REGION: Region = {
  latitude: 14.55,
  longitude: 121.0,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [, setRegion] = useState(DEFAULT_REGION);
  const [reportVisible, setReportVisible] = useState(false);

  const { filters, toggleCarrier, toggleNetworkType } = useFilters();
  const { signals, heatmapTiles, fetchData } = useMapData();

  const handleNewLog = useCallback((log: SignalLog) => {
    console.log('New signal log:', log.signal.dbm, log.carrier);
  }, []);

  const { isActive, currentSignal, toggle } = useSignalLogger(handleNewLog);

  const handleRegionChange = useCallback(
    (newRegion: Region) => {
      setRegion(newRegion);

      const zoom = Math.round(Math.log2(360 / newRegion.longitudeDelta));
      const viewport: ViewportBounds = {
        sw: [
          newRegion.longitude - newRegion.longitudeDelta / 2,
          newRegion.latitude - newRegion.latitudeDelta / 2,
        ],
        ne: [
          newRegion.longitude + newRegion.longitudeDelta / 2,
          newRegion.latitude + newRegion.latitudeDelta / 2,
        ],
      };
      fetchData(viewport, zoom, filters);
    },
    [fetchData, filters],
  );

  const handleReportSubmit = useCallback(
    (data: any) => {
      console.log('Report submitted:', data);
    },
    [],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={handleRegionChange}
        customMapStyle={darkMapStyle}
      >
        {/* Heatmap circles from aggregated tiles */}
        {heatmapTiles.map((tile, i) => (
          <Circle
            key={`heat-${i}`}
            center={{
              latitude: (tile.swLat + tile.neLat) / 2,
              longitude: (tile.swLng + tile.neLng) / 2,
            }}
            radius={300}
            fillColor={getHeatmapColor(tile.avgDbm)}
            strokeWidth={0}
          />
        ))}

        {/* Individual signal pins */}
        {signals.map((sig, i) => (
          <Marker
            key={`pin-${i}`}
            coordinate={{
              latitude: sig.location.coordinates[1],
              longitude: sig.location.coordinates[0],
            }}
            pinColor={getSignalColor(sig.signal.dbm)}
          />
        ))}
      </MapView>

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

function getHeatmapColor(dbm: number): string {
  const color = getSignalColor(dbm);
  // Add transparency for overlay effect
  return color + '40';
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

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
