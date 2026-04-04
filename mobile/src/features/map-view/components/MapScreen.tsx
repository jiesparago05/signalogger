import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Dimensions, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SwipeableSheet } from './SwipeableSheet';
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
import { ScrollView } from 'react-native';
import { DraggableButtonGroup } from './DraggableButton';
import { SessionsList } from '../../sessions/components/SessionsList';
import { SessionDetail } from '../../sessions/components/SessionDetail';
import { RoutesList } from '../../routes/components/RoutesList';
import { RouteDetail } from '../../routes/components/RouteDetail';
import { MappingSession, CommuteRoute } from '../../../types/signal';
import { LocationComparison } from '../../comparison/components/LocationComparison';
import { RouteComparison } from '../../comparison/components/RouteComparison';
import { SaveRouteModal } from '../../sessions/components/SaveRouteModal';
import { useDeadZone } from '../../dead-zone/hooks/use-dead-zone';
import { DeadZoneBanner } from '../../dead-zone/components/DeadZoneBanner';

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
    .signal-tooltip .leaflet-popup-content-wrapper {
      background: #111827;
      border: 1px solid #374151;
      border-radius: 10px;
      color: #F9FAFB;
      padding: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .signal-tooltip .leaflet-popup-tip {
      background: #111827;
      border-right: 1px solid #374151;
      border-bottom: 1px solid #374151;
    }
    .signal-tooltip .leaflet-popup-content {
      margin: 8px 12px;
      font-size: 11px;
      line-height: 1.4;
    }
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

    function setUserMarkerDead(isDead) {
      if (!userMarker) return;
      var color = isDead ? '#9CA3AF' : '#22C55E';
      var icon = L.divIcon({
        className: 'user-location',
        html: '<div style="position:relative;width:22px;height:22px;">' +
          '<div style="position:absolute;width:22px;height:22px;border-radius:50%;background:' + color + '40;' + (isDead ? '' : 'animation:pulse 2s infinite;') + '"></div>' +
          '<div style="position:absolute;top:4px;left:4px;width:14px;height:14px;border-radius:50%;background:' + color + ';border:2.5px solid #F9FAFB;' + (isDead ? 'opacity:0.5;' : '') + '"></div>' +
          '</div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      userMarker.setIcon(icon);
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

    function addMarker(lat, lng, color, id) {
      var icon = L.divIcon({
        className: 'signal-marker',
        html: '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';border:1.5px solid rgba(255,255,255,0.3);box-shadow:0 0 6px ' + color + '44;"></div>',
        iconSize: [10, 10],
      });
      var m = L.marker([lat, lng], { icon: icon }).addTo(map);
      if (id) {
        m._signalogId = id;
        m._isConsolidated = false;
        m.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'dotTap', id: id, isConsolidated: false, lat: lat, lng: lng
          }));
        });
      }
      markers.push(m);
    }

    function addConsolidatedMarker(lat, lng, color, count, id) {
      var icon = L.divIcon({
        className: 'consolidated-marker',
        html: '<div style="position:relative;width:18px;height:18px;">' +
          '<div style="width:18px;height:18px;border-radius:50%;background:' + color + ';border:2px solid rgba(255,255,255,0.6);box-shadow:0 0 8px ' + color + '66;"></div>' +
          '<div style="position:absolute;top:-6px;right:-8px;background:#111827;color:#fff;font-size:7px;padding:1px 3px;border-radius:3px;min-width:12px;text-align:center">' + count + '\u00d7</div>' +
          '</div>',
        iconSize: [18, 18],
      });
      var m = L.marker([lat, lng], { icon: icon }).addTo(map);
      m._signalogId = id;
      m._isConsolidated = true;
      m.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'dotTap', id: id, isConsolidated: true, lat: lat, lng: lng
        }));
      });
      markers.push(m);
    }

    var tooltipLayer = null;
    function showTooltip(lat, lng, html) {
      hideTooltip();
      tooltipLayer = L.popup({ closeButton: false, className: 'signal-tooltip', offset: [0, -12] })
        .setLatLng([lat, lng])
        .setContent(html)
        .openOn(map);
    }

    function hideTooltip() {
      if (tooltipLayer) { map.closePopup(tooltipLayer); tooltipLayer = null; }
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

    var sessionPolylines = [];
    var sessionMarkers = [];

    function drawSessionTrail(trailData) {
      clearSessionTrail();
      if (!trailData || trailData.length < 2) return;

      var GAP_MS = 2 * 60 * 1000; // 2 minutes = gap
      var currentPoints = [[trailData[0].lat, trailData[0].lng]];

      for (var i = 1; i < trailData.length; i++) {
        var p = trailData[i];
        var prev = trailData[i - 1];
        var timeDiff = (p.ts && prev.ts) ? (p.ts - prev.ts) : 0;

        if (timeDiff > GAP_MS) {
          // Draw solid segment up to here
          if (currentPoints.length >= 2) {
            var solidLine = L.polyline(currentPoints, {
              color: '#3B82F6', weight: 6, opacity: 0.9,
              lineCap: 'round', lineJoin: 'round'
            }).addTo(map);
            sessionPolylines.push(solidLine);
          }
          // Draw dashed gray line across the gap
          var gapLine = L.polyline(
            [[prev.lat, prev.lng], [p.lat, p.lng]],
            { color: '#6B7280', weight: 3, opacity: 0.7, dashArray: '8, 6' }
          ).addTo(map);
          sessionPolylines.push(gapLine);
          // Start new segment
          currentPoints = [[p.lat, p.lng]];
        } else {
          currentPoints.push([p.lat, p.lng]);
        }
      }
      // Draw last segment
      if (currentPoints.length >= 2) {
        var lastLine = L.polyline(currentPoints, {
          color: '#3B82F6', weight: 6, opacity: 0.9,
          lineCap: 'round', lineJoin: 'round'
        }).addTo(map);
        sessionPolylines.push(lastLine);
      }

      // Start marker (green)
      var startM = L.circleMarker(
        [trailData[0].lat, trailData[0].lng],
        { radius: 7, fillColor: '#22C55E', fillOpacity: 1, stroke: true, color: '#fff', weight: 3 }
      ).addTo(map);
      sessionMarkers.push(startM);

      // End marker (red)
      var endM = L.circleMarker(
        [trailData[trailData.length-1].lat, trailData[trailData.length-1].lng],
        { radius: 7, fillColor: '#EF4444', fillOpacity: 1, stroke: true, color: '#fff', weight: 3 }
      ).addTo(map);
      sessionMarkers.push(endM);

      // Fit map bounds to trail
      var lats = trailData.map(function(p) { return p.lat; });
      var lngs = trailData.map(function(p) { return p.lng; });
      map.fitBounds([
        [Math.min.apply(null, lats) - 0.002, Math.min.apply(null, lngs) - 0.002],
        [Math.max.apply(null, lats) + 0.002, Math.max.apply(null, lngs) + 0.002]
      ], { paddingTopLeft: [20, 20], paddingBottomRight: [20, 300] });
    }

    function clearSessionTrail() {
      sessionPolylines.forEach(function(l) { map.removeLayer(l); });
      sessionMarkers.forEach(function(m) { map.removeLayer(m); });
      sessionPolylines = [];
      sessionMarkers = [];
      if (window._highlightMarker) { map.removeLayer(window._highlightMarker); window._highlightMarker = null; }
    }

    function highlightReading(lat, lng, color) {
      if (window._highlightMarker) { map.removeLayer(window._highlightMarker); }
      window._highlightMarker = L.circleMarker([lat, lng], {
        radius: 12,
        fillColor: color,
        color: '#FFFFFF',
        weight: 3,
        fillOpacity: 0.9,
      }).addTo(map);
      map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true });
    }

    function getMapState() {
      var c = map.getCenter();
      return JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    }
    function restoreMapState(lat, lng, zoom) {
      if (window._highlightMarker) { map.removeLayer(window._highlightMarker); window._highlightMarker = null; }
      map.setView([lat, lng], zoom, { animate: true });
    }

    map.on('click', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapTap',
        lng: e.latlng.lng,
        lat: e.latlng.lat,
      }));
    });

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
  const [activeTab, setActiveTab] = useState<'live' | 'sessions' | 'routes'>('live');
  const [selectedSession, setSelectedSession] = useState<MappingSession | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<CommuteRoute | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [heatmapVisible, setHeatmapVisible] = useState(true);
  const [sheetHeight, setSheetHeight] = useState(Math.round(Dimensions.get('window').height * 0.42));
  const [completedSession, setCompletedSession] = useState<MappingSession | null>(null);
  const [sessionsKey, setSessionsKey] = useState(0);
  const [compareVisible, setCompareVisible] = useState(false);
  const [compareCoords, setCompareCoords] = useState<[number, number] | null>(null);
  const [routeCompareId, setRouteCompareId] = useState<string | null>(null);
  const [routeCompareName, setRouteCompareName] = useState('');
  const [dotDetail, setDotDetail] = useState<any>(null);
  const [dotTooltip, setDotTooltip] = useState<any>(null);
  const savedMapState = useRef<{ lat: number; lng: number; zoom: number } | null>(null);

  const { filters, toggleCarrier, toggleNetworkType } = useFilters();
  const { signals, consolidated, heatmapTiles, fetchData } = useMapData();
  const { status: syncStatus } = useSync();

  const { activeSession, startSession, addLog, completeSession } = useSession();

  const handleNewLog = useCallback((log: SignalLog) => {
    addLog(log);
  }, [addLog]);

  const { isActive, currentSignal, stability, toggle } = useSignalLogger(handleNewLog, activeSession?._id);

  const { inDeadZone, processReading } = useDeadZone();

  // Feed signal readings to dead zone detector
  React.useEffect(() => {
    if (currentSignal) {
      processReading(
        currentSignal.signal.dbm,
        currentSignal.carrier,
        currentSignal.networkType,
      );
    }
  }, [currentSignal, processReading]);

  // Gray out user marker + clear heatmap when in dead zone
  React.useEffect(() => {
    webViewRef.current?.injectJavaScript(`setUserMarkerDead(${inDeadZone}); true;`);
    if (inDeadZone) {
      webViewRef.current?.injectJavaScript('clearOverlays(); true;');
    }
  }, [inDeadZone]);

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
          setCompletedSession(completed);
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
        } else if (data.type === 'dotTap') {
          if (dotTooltip && dotTooltip.id === data.id) {
            // Second tap — show full detail card
            setDotDetail(data);
            setDotTooltip(null);
            webViewRef.current?.injectJavaScript('hideTooltip(); true;');
          } else {
            // First tap — show tooltip
            setDotTooltip(data);
            setDotDetail(null);
            const tooltipHtml = data.isConsolidated
              ? buildConsolidatedTooltip(data, consolidated)
              : buildFreshTooltip(data, signals);
            webViewRef.current?.injectJavaScript(
              `showTooltip(${data.lat},${data.lng},'${tooltipHtml.replace(/'/g, "\\'")}'); true;`
            );
          }
        } else if (data.type === 'mapTap') {
          // Dismiss tooltip/detail on any map tap
          if (dotTooltip || dotDetail) {
            setDotTooltip(null);
            setDotDetail(null);
            webViewRef.current?.injectJavaScript('hideTooltip(); true;');
          } else if (compareMode) {
            setCompareCoords([data.lng, data.lat]);
            setCompareVisible(true);
          }
        }
      } catch {}
    },
    [fetchData, filters, compareMode, dotTooltip, dotDetail, signals, consolidated],
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

    // Hide dots/heatmap when viewing a session detail (only trail shows)
    if (selectedSession) {
      webViewRef.current.injectJavaScript(js + 'true;');
      return;
    }

    // Heatmap toggle is the master switch — OFF = clean map
    // Don't show heatmap during dead zone
    if (heatmapVisible && !inDeadZone) {
      signals.forEach((sig) => {
        const color = getSignalColor(sig.signal.dbm);
        js += `addMarker(${sig.location.coordinates[1]},${sig.location.coordinates[0]},'${color}','${sig._id}');`;
      });

      // Consolidated dots
      consolidated.forEach((c) => {
        const color = getSignalColor(c.avgDbm);
        js += `addConsolidatedMarker(${c.location.coordinates[1]},${c.location.coordinates[0]},'${color}',${c.count},'${c._id}');`;
      });

      heatmapTiles.forEach((tile) => {
        const color = getSignalColor(tile.avgDbm);
        const lat = (tile.swLat + tile.neLat) / 2;
        const lng = (tile.swLng + tile.neLng) / 2;
        js += `addHeatCircle(${lat},${lng},300,'${color}');`;
      });
    }

    webViewRef.current.injectJavaScript(js + 'true;');
  }, [signals, consolidated, heatmapTiles, heatmapVisible, inDeadZone, selectedSession]);

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

  function buildFreshTooltip(data: any, signals: any[]): string {
    const sig = signals.find((s) => s._id === data.id);
    if (!sig) return '';
    const color = getSignalColor(sig.signal.dbm);
    const time = new Date(sig.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div style="font-size:11px"><span style="color:${color};font-size:15px;font-weight:bold">${sig.signal.dbm}</span> <span style="color:#9CA3AF">dBm</span><br/><span style="color:#9CA3AF">${sig.carrier} · ${sig.networkType}</span><br/><span style="color:#6B7280;font-size:9px">${time}</span></div>`;
  }

  function buildConsolidatedTooltip(data: any, consolidated: any[]): string {
    const c = consolidated.find((r) => r._id === data.id);
    if (!c) return '';
    const color = getSignalColor(c.avgDbm);
    const first = new Date(c.firstTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const last = new Date(c.lastTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `<div style="font-size:11px"><span style="color:${color};font-size:15px;font-weight:bold">${c.avgDbm}</span> <span style="color:#9CA3AF">avg dBm</span><br/><span style="color:#9CA3AF">${c.carrier} · ${c.networkType} · ${c.count} readings</span><br/><span style="color:#6B7280;font-size:9px">Range: ${c.maxDbm} to ${c.minDbm}</span><br/><span style="color:#6B7280;font-size:9px">${first} — ${last}</span></div>`;
  }

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

      {/* Dead zone banner replaces filter chips when active */}
      {inDeadZone ? (
        <DeadZoneBanner visible={true} />
      ) : (
        <FilterChips
          filters={filters}
          onToggleCarrier={toggleCarrier}
          onToggleNetworkType={toggleNetworkType}
          onSearchSelect={(loc) => {
            webViewRef.current?.injectJavaScript(
              `map.setView([${loc.lat},${loc.lng}], 15); true;`,
            );
          }}
        />
      )}

      {/* Draggable button group — hide when session, route detail, or dot detail is open */}
      {!selectedSession && !selectedRoute && !dotDetail && !routeCompareId && (
        <DraggableButtonGroup
          sheetHeight={sheetHeight}
          actions={[
            { icon: '\u25CE', iconSize: 20, onPress: inDeadZone ? () => {} : () => centerOnUser(), active: inDeadZone ? false : undefined },
            { icon: '\uD83D\uDCCA', iconSize: 18, onPress: inDeadZone ? () => {} : () => setCompareMode((prev: boolean) => !prev), active: inDeadZone ? false : compareMode },
            { icon: '\uD83D\uDD25', iconSize: 18, onPress: inDeadZone ? () => {} : () => setHeatmapVisible((prev: boolean) => !prev), active: inDeadZone ? false : heatmapVisible },
            { icon: '\u26A0\uFE0F', iconSize: 18, onPress: () => setReportVisible(true) },
          ]}
        />
      )}

      {/* Bottom sheet */}
      <SwipeableSheet
        collapsedHeight={Math.round(Dimensions.get('window').height * 0.15)}
        expandedHeight={Math.round(Dimensions.get('window').height * 0.38)}
        onHeightChange={setSheetHeight}
      >

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {(['live', 'sessions', 'routes'] as const).map((tab) => (
            <View
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onTouchEnd={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'live' ? 'Live' : tab === 'sessions' ? 'Sessions' : 'Routes'}
              </Text>
            </View>
          ))}
        </View>

        {/* Live tab */}
        {activeTab === 'live' && (
          <View>
            <SignalDisplay signal={currentSignal} isLogging={isActive} stability={stability} compact inDeadZone={inDeadZone} />
            <View
              style={[styles.cta, isActive && styles.ctaActive, (inDeadZone && !isActive) && styles.ctaDisabled]}
              onTouchEnd={(inDeadZone && !isActive) ? undefined : () => handleToggle()}
            >
              <Text style={[styles.ctaText, isActive && styles.ctaTextActive, (inDeadZone && !isActive) && styles.ctaTextDisabled]}>
                {isActive ? 'Stop Mapping' : inDeadZone ? 'No Signal' : 'Start Mapping'}
              </Text>
            </View>
          </View>
        )}

        {/* Sessions tab */}
        {activeTab === 'sessions' && (
          <View style={styles.tabContent}>
            <SessionsList key={sessionsKey} onSelectSession={(s) => setSelectedSession(s)} isMapping={isActive} />
          </View>
        )}

        {/* Routes tab */}
        {activeTab === 'routes' && (
          <View style={styles.tabContent}>
            <RoutesList onSelectRoute={(r) => setSelectedRoute(r)} />
          </View>
        )}
      </SwipeableSheet>

      {/* Session detail overlay - shows in bottom area, trail drawn on main map */}
      {selectedSession && (
        <View style={styles.sessionOverlay}>
          <SessionDetail
            session={selectedSession}
            onBack={() => {
              setSelectedSession(null);
            }}
            onDrawTrail={(trail) => {
              const trailJSON = JSON.stringify(trail);
              webViewRef.current?.injectJavaScript(`drawSessionTrail(${trailJSON}); true;`);
            }}
            onClearTrail={() => {
              webViewRef.current?.injectJavaScript('clearSessionTrail(); true;');
            }}
            onSaveAsRoute={() => {
              setCompletedSession(selectedSession);
            }}
            onHighlightReading={(lat, lng, color) => {
              webViewRef.current?.injectJavaScript(`highlightReading(${lat},${lng},'${color}'); true;`);
            }}
          />
        </View>
      )}

      {/* Signal dot detail card */}
      {dotDetail && (
        <View style={styles.dotDetailOverlay}>
          <View style={styles.dotDetailCard}>
            <View style={styles.dotDetailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dotDetailTitle}>{dotDetail.isConsolidated ? 'Signal Summary' : 'Signal Reading'}</Text>
                <Text style={styles.dotDetailSub}>
                  {(() => {
                    const item = dotDetail.isConsolidated
                      ? consolidated.find((c) => c._id === dotDetail.id)
                      : signals.find((s) => s._id === dotDetail.id);
                    if (!item) return '';
                    return dotDetail.isConsolidated
                      ? `${item.carrier} · ${item.networkType} · ${item.count} readings`
                      : `${item.carrier} · ${item.networkType}`;
                  })()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {(() => {
                  const item = dotDetail.isConsolidated
                    ? consolidated.find((c) => c._id === dotDetail.id)
                    : signals.find((s) => s._id === dotDetail.id);
                  const dbm = item ? (dotDetail.isConsolidated ? item.avgDbm : item.signal.dbm) : 0;
                  return (
                    <>
                      <Text style={[styles.dotDetailDbm, { color: getSignalColor(dbm) }]}>{dbm}</Text>
                      <Text style={styles.dotDetailDbmLabel}>{dotDetail.isConsolidated ? 'avg dBm' : 'dBm'}</Text>
                    </>
                  );
                })()}
              </View>
            </View>
            {dotDetail.isConsolidated && (() => {
              const c = consolidated.find((r) => r._id === dotDetail.id);
              if (!c) return null;
              return (
                <View style={styles.dotDetailRange}>
                  <View style={styles.dotDetailRangeLabels}>
                    <Text style={[styles.dotDetailRangeText, { color: '#22C55E' }]}>Best: {c.maxDbm}</Text>
                    <Text style={[styles.dotDetailRangeText, { color: '#EF4444' }]}>Worst: {c.minDbm}</Text>
                  </View>
                  <View style={styles.dotDetailBar}>
                    <View style={styles.dotDetailBarGradient} />
                  </View>
                </View>
              );
            })()}
            <View style={styles.dotDetailClose} onTouchEnd={() => { setDotDetail(null); webViewRef.current?.injectJavaScript('hideTooltip(); true;'); }}>
              <Text style={styles.dotDetailCloseText}>Close</Text>
            </View>
          </View>
        </View>
      )}

      {/* Route detail overlay */}
      {selectedRoute && (
        <View style={styles.sessionOverlay}>
          <RouteDetail
            route={selectedRoute}
            onBack={() => setSelectedRoute(null)}
            onCompare={(routeId, routeName) => {
              setSelectedRoute(null);
              setRouteCompareId(routeId);
              setRouteCompareName(routeName);
            }}
          />
        </View>
      )}

      {/* Location comparison popup */}
      <LocationComparison
        visible={compareVisible}
        coordinates={compareCoords}
        onClose={() => {
          setCompareVisible(false);
          setCompareCoords(null);
        }}
      />

      {/* Route comparison overlay */}
      {routeCompareId && (
        <View style={styles.sessionOverlay}>
          <RouteComparison
            routeId={routeCompareId}
            routeName={routeCompareName}
            onBack={() => {
              setRouteCompareId(null);
              setRouteCompareName('');
            }}
          />
        </View>
      )}

      {/* Save route modal after session complete */}
      {completedSession && (
        <SaveRouteModal
          visible={!!completedSession}
          session={completedSession}
          onSaved={(routeId) => {
            // Update session with routeId locally
            AsyncStorage.getItem('@signalog_sessions').then((raw) => {
              if (!raw) return;
              const sessions = JSON.parse(raw);
              const idx = sessions.findIndex((s: any) => s._id === completedSession._id);
              if (idx >= 0) {
                sessions[idx] = { ...sessions[idx], routeId };
                AsyncStorage.setItem('@signalog_sessions', JSON.stringify(sessions)).catch(() => {});
              }
            }).catch(() => {});
            // Update selectedSession so SessionDetail hides "Save as Route"
            if (selectedSession && selectedSession._id === completedSession._id) {
              setSelectedSession({ ...selectedSession, routeId });
            }
            setCompletedSession(null);
            setSessionsKey((k) => k + 1);
            Alert.alert('Route Saved', 'Your route has been saved successfully.');
          }}
          onSkip={() => setCompletedSession(null)}
        />
      )}

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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#22C55E',
  },
  tabText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#22C55E',
    fontWeight: '600',
  },
  tabContent: {
    maxHeight: 250,
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
  ctaDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  ctaTextDisabled: {
    color: '#9CA3AF',
  },
  sessionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Math.round(Dimensions.get('window').height * 0.55),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  dotDetailOverlay: { position: 'absolute', top: '30%', left: 0, right: 0, padding: 16 },
  dotDetailCard: { backgroundColor: '#111827', borderRadius: 14, borderWidth: 1, borderColor: '#374151', padding: 16 },
  dotDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dotDetailTitle: { color: '#F9FAFB', fontSize: 15, fontWeight: 'bold' },
  dotDetailSub: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  dotDetailDbm: { fontSize: 22, fontWeight: 'bold' },
  dotDetailDbmLabel: { color: '#9CA3AF', fontSize: 9 },
  dotDetailRange: { backgroundColor: '#1F2937', borderRadius: 8, padding: 10, marginBottom: 12 },
  dotDetailRangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dotDetailRangeText: { fontSize: 10 },
  dotDetailBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  dotDetailBarGradient: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EAB308' },
  dotDetailClose: { padding: 8, alignItems: 'center' },
  dotDetailCloseText: { color: '#9CA3AF', fontSize: 13 },
});
