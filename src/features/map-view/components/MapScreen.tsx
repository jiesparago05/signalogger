import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { FilterChips } from './FilterChips';
import { SignalDisplay } from '../../signal-logging/components/SignalDisplay';
import { ReportModal } from '../../manual-report/components/ReportModal';
import { useMapData } from '../hooks/use-map-data';
import { useFilters } from '../hooks/use-filters';
import { useSignalLogger } from '../../signal-logging/hooks/use-signal-logger';
import { useSession } from '../../sessions/hooks/use-session';
import { getSignalColor } from '../../../lib/config';
import { ViewportBounds, SignalLog } from '../../../types/signal';
import { getCurrentLocation, watchLocation, clearWatch } from '../../signal-logging/services/location-service';
import { useSync } from '../../offline-sync/hooks/use-sync';
import { addReport } from '../../offline-sync/services/log-store';
import { getDeviceId } from '../../../lib/config/device';
import { Alert } from 'react-native';

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    #map { width: 100vw; height: 100vh; }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([14.55, 121.0], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    var userMarker = null;

    function setUserLocation(lat, lng) {
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      } else {
        var icon = L.divIcon({
          className: 'user-location',
          html: '<div style="position:relative;width:22px;height:22px;">' +
            '<div style="position:absolute;width:22px;height:22px;border-radius:50%;background:rgba(34,197,94,0.25);animation:pulse 2s infinite;"></div>' +
            '<div style="position:absolute;top:4px;left:4px;width:14px;height:14px;border-radius:50%;background:#22C55E;border:2.5px solid #F9FAFB;"></div>' +
            '</div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        userMarker = L.marker([lat, lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
      }
    }

    // Add pulse animation
    var style = document.createElement('style');
    style.textContent = '@keyframes pulse { 0% { transform:scale(1); opacity:1; } 100% { transform:scale(2.5); opacity:0; } }';
    document.head.appendChild(style);

    var markers = [];
    var circles = [];

    function clearOverlays() {
      markers.forEach(function(m) { map.removeLayer(m); });
      circles.forEach(function(c) { map.removeLayer(c); });
      markers = [];
      circles = [];
    }

    function addMarker(lat, lng, color) {
      var icon = L.divIcon({
        className: 'signal-marker',
        html: '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';border:1.5px solid rgba(255,255,255,0.3);box-shadow:0 0 6px ' + color + '44;"></div>',
        iconSize: [10, 10],
      });
      var m = L.marker([lat, lng], { icon: icon }).addTo(map);
      markers.push(m);
    }

    function addHeatCircle(lat, lng, radius, color) {
      var c = L.circle([lat, lng], {
        radius: radius,
        fillColor: color,
        fillOpacity: 0.2,
        stroke: false,
      }).addTo(map);
      circles.push(c);
    }

    map.on('moveend', function() {
      var bounds = map.getBounds();
      var zoom = map.getZoom();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'regionChange',
        sw: [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
        ne: [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
        zoom: zoom,
      }));
    });

    // Initial bounds report
    setTimeout(function() {
      var bounds = map.getBounds();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'regionChange',
        sw: [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
        ne: [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
        zoom: map.getZoom(),
      }));
    }, 1000);
  </script>
</body>
</html>
`;

export function MapScreen() {
  const webViewRef = useRef<WebView>(null);
  const lastViewport = useRef<{ bounds: ViewportBounds; zoom: number } | null>(null);
  const busyRef = useRef(false);
  const [reportVisible, setReportVisible] = useState(false);

  const { filters, toggleCarrier, toggleNetworkType } = useFilters();
  const { signals, heatmapTiles, fetchData } = useMapData();
  const { status: syncStatus } = useSync();

  const { activeSession, startSession, addLog, completeSession } = useSession();

  const handleNewLog = useCallback((log: SignalLog) => {
    addLog(log);
  }, [addLog]);

  const { isActive, currentSignal, stability, toggle } = useSignalLogger(handleNewLog);

  const updateUserMarker = useCallback((lat: number, lng: number) => {
    webViewRef.current?.injectJavaScript(
      `setUserLocation(${lat},${lng}); true;`,
    );
  }, []);

  const centerOnUser = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const loc = await getCurrentLocation();
      const [lng, lat] = loc.coordinates;
      updateUserMarker(lat, lng);
      webViewRef.current?.injectJavaScript(
        `map.setView([${lat},${lng}], 15); true;`,
      );
    } catch (err) {
      console.warn('centerOnUser failed:', err);
    } finally {
      busyRef.current = false;
    }
  }, [updateUserMarker]);

  // Watch location while logging — update dot
  React.useEffect(() => {
    if (!isActive) return;

    let watchId: number | null = null;
    try {
      watchId = watchLocation(
        (loc) => {
          const [lng, lat] = loc.coordinates;
          updateUserMarker(lat, lng);
        },
        (err) => console.warn('watchLocation error:', err),
      );
    } catch (err) {
      console.warn('Failed to start watchLocation:', err);
    }

    return () => {
      if (watchId !== null) {
        try { clearWatch(watchId); } catch {}
      }
    };
  }, [isActive, updateUserMarker]);

  // Center on user on first load
  React.useEffect(() => {
    const timer = setTimeout(() => centerOnUser(), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleToggle = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (isActive) {
        await toggle();
        const completed = await completeSession();
        if (completed) {
          Alert.alert(
            'Session Complete',
            `${completed.logCount} logs \u00B7 ${completed.distanceMeters}m \u00B7 avg ${completed.avgDbm} dBm`,
            [{ text: 'OK' }],
          );
        }
      } else {
        const carrier = currentSignal?.carrier || 'Unknown';
        const networkType = currentSignal?.networkType || 'none';
        await startSession(carrier, networkType);
        await toggle();
        setTimeout(() => centerOnUser(), 1500);
      }
    } catch (err) {
      console.warn('handleToggle error:', err);
    } finally {
      setTimeout(() => { busyRef.current = false; }, 2000);
    }
  }, [toggle, isActive, currentSignal, startSession, completeSession, centerOnUser]);

  const handleWebViewMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'regionChange') {
          const viewport: ViewportBounds = {
            sw: data.sw,
            ne: data.ne,
          };
          lastViewport.current = { bounds: viewport, zoom: data.zoom };
          fetchData(viewport, data.zoom, filters);
        }
      } catch {}
    },
    [fetchData, filters],
  );

  // Refetch when filters change (without needing a map move)
  React.useEffect(() => {
    if (lastViewport.current) {
      fetchData(lastViewport.current.bounds, lastViewport.current.zoom, filters);
    }
  }, [filters, fetchData]);

  // Send overlay data to WebView when signals/heatmap change
  const updateOverlays = useCallback(() => {
    if (!webViewRef.current) return;

    let js = 'clearOverlays();';

    signals.forEach((sig) => {
      const color = getSignalColor(sig.signal.dbm);
      js += `addMarker(${sig.location.coordinates[1]},${sig.location.coordinates[0]},'${color}');`;
    });

    heatmapTiles.forEach((tile) => {
      const color = getSignalColor(tile.avgDbm);
      const lat = (tile.swLat + tile.neLat) / 2;
      const lng = (tile.swLng + tile.neLng) / 2;
      js += `addHeatCircle(${lat},${lng},300,'${color}');`;
    });

    webViewRef.current.injectJavaScript(js + 'true;');
  }, [signals, heatmapTiles]);

  // Update overlays when data changes
  React.useEffect(() => {
    updateOverlays();
  }, [updateOverlays]);

  const reportBusyRef = useRef(false);
  const handleReportSubmit = useCallback(
    async (data: { category: any; note: string; attachments: any[] }) => {
      if (reportBusyRef.current) return;
      reportBusyRef.current = true;
      try {
        const [location, deviceId] = await Promise.all([
          getCurrentLocation().catch(() => ({
            type: 'Point' as const,
            coordinates: [0, 0] as [number, number],
            accuracy: 0,
          })),
          getDeviceId(),
        ]);

        await addReport({
          timestamp: new Date(),
          location: { type: 'Point', coordinates: location.coordinates },
          carrier: currentSignal?.carrier || 'Unknown',
          networkType: currentSignal?.networkType || 'none',
          category: data.category,
          note: data.note,
          attachments: data.attachments,
          deviceId,
          synced: false,
        });

        Alert.alert('Report Submitted', 'Your signal report has been saved and will sync when connected.');
      } catch (err) {
        console.warn('Report submit error:', err);
        Alert.alert('Error', 'Failed to save report. Please try again.');
      } finally {
        setTimeout(() => { reportBusyRef.current = false; }, 3000);
      }
    },
    [currentSignal],
  );

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: LEAFLET_HTML }}
        onMessage={handleWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />

      {/* Filter dropdowns */}
      <FilterChips
        filters={filters}
        onToggleCarrier={toggleCarrier}
        onToggleNetworkType={toggleNetworkType}
      />

      {/* Locate button */}
      <View
        style={styles.locateBtn}
        onTouchEnd={() => centerOnUser()}
      >
        <Text style={styles.locateBtnText}>{'\u25CE'}</Text>
      </View>

      {/* Report button */}
      <View
        style={styles.reportBtn}
        onTouchEnd={() => setReportVisible(true)}
      >
        <Text style={styles.reportBtnText}>{'\u26A0\uFE0F'}</Text>
      </View>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        <SignalDisplay signal={currentSignal} isLogging={isActive} stability={stability} compact />
        <View
          style={[styles.cta, isActive && styles.ctaActive]}
          onTouchEnd={() => handleToggle()}
        >
          <Text style={[styles.ctaText, isActive && styles.ctaTextActive]}>
            {isActive ? 'Stop Mapping' : 'Start Mapping'}
          </Text>
        </View>
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
    backgroundColor: '#111827',
  },
  map: {
    flex: 1,
  },
  locateBtn: {
    position: 'absolute',
    right: 16,
    bottom: 310,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  locateBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  reportBtn: {
    position: 'absolute',
    right: 16,
    bottom: 256,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  reportBtnText: {
    fontSize: 18,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  cta: {
    backgroundColor: '#22C55E',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ctaTextActive: {
    color: '#EF4444',
  },
});
