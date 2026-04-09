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
import { getActivityLevel, ACTIVITY_SHORT } from '../../../lib/utils/activity-levels';
import { formatRelative } from '../../../lib/utils/format-relative';
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
    var map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([14.55, 121.0], 12);

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

    function addMarker(lat, lng, color, id, noInternet) {
      // Phase 1: if the reading was classified NO_INTERNET, add a visible orange
      // ring so it stands out from "weak but working" readings of the same color.
      var strokeOpts = noInternet
        ? { stroke: true, color: '#FB923C', weight: 2.5, opacity: 0.95 }
        : { stroke: false };
      var m = L.circleMarker([lat, lng], Object.assign({
        radius: 7, fillColor: color, fillOpacity: 0.25,
        interactive: true, bubblingMouseEvents: false,
      }, strokeOpts)).addTo(map);
      if (id) {
        m._signalogId = id;
        m._isConsolidated = false;
        m.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'dotTap', id: id, isConsolidated: false, lat: lat, lng: lng
          }));
        });
      }
      markers.push(m);
    }

    function addConsolidatedMarker(lat, lng, color, count, id) {
      // Scale size by count: min 10, max 16 (bigger tap target)
      var radius = Math.min(16, Math.max(10, 7 + Math.log2(count) * 2));
      var m = L.circleMarker([lat, lng], {
        radius: radius,
        fillColor: color,
        fillOpacity: 0.3,
        stroke: false,
        interactive: true, bubblingMouseEvents: false,
      }).addTo(map);
      m._signalogId = id;
      m._isConsolidated = true;
      m.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
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
        fillOpacity: 0.12,
        color: color,
        weight: 1,
        opacity: 0.15,
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

    function hideDots() {
      markers.forEach(function(m) { map.removeLayer(m); });
      circles.forEach(function(c) { map.removeLayer(c); });
    }
    function showDots() {
      markers.forEach(function(m) { map.addLayer(m); });
      circles.forEach(function(c) { map.addLayer(c); });
    }

    // Ungrouped reading dots for Signal Summary
    var _ungroupedMarkers = [];
    function showUngroupedReadings(readings) {
      clearUngroupedReadings();
      readings.forEach(function(r) {
        if (!r.lat || !r.lng) return;
        var m = L.circleMarker([r.lat, r.lng], {
          radius: 8,
          fillColor: r.color,
          color: 'rgba(255,255,255,0.4)',
          weight: 1.5,
          fillOpacity: 0.8,
        }).addTo(map);
        m._readingIdx = r.idx;
        _ungroupedMarkers.push(m);
      });
      // Fit map to show all ungrouped dots
      if (_ungroupedMarkers.length > 0) {
        var group = L.featureGroup(_ungroupedMarkers);
        map.fitBounds(group.getBounds().pad(0.3), { animate: true, maxZoom: 18 });
      }
    }
    function clearUngroupedReadings() {
      _ungroupedMarkers.forEach(function(m) { map.removeLayer(m); });
      _ungroupedMarkers = [];
    }
    function highlightUngroupedReading(idx, lat, lng, color) {
      // Dim all ungrouped dots, highlight selected
      _ungroupedMarkers.forEach(function(m) {
        if (m._readingIdx === idx) {
          m.setStyle({ radius: 14, fillColor: color, color: '#FFFFFF', weight: 3, fillOpacity: 1.0 });
          m.bringToFront();
        } else {
          m.setStyle({ radius: 6, fillOpacity: 0.3, weight: 1, color: 'rgba(255,255,255,0.2)' });
        }
      });
      if (window._highlightMarker) { map.removeLayer(window._highlightMarker); window._highlightMarker = null; }
      map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true });
    }

    function highlightReading(lat, lng, color) {
      hideDots();
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
      clearUngroupedReadings();
      showDots();
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
  const dotDetailItemRef = useRef<any>(null);
  const [dotTooltip, setDotTooltip] = useState<any>(null);
  const savedMapState = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedReadingIdx, setSelectedReadingIdx] = useState<number | null>(null);
  const [showAllReadings, setShowAllReadings] = useState(false);

  const { filters, toggleCarrier, toggleNetworkType, setDefaultCarrier } = useFilters();
  const {
    signals, consolidated, reports, heatmapTiles, isLoading, error, fetchData,
    breakdownReadings, breakdownLoading, breakdownError, fetchReadings, clearBreakdown,
  } = useMapData();
  const { status: syncStatus } = useSync();

  const { activeSession, startSession, addLog, completeSession } = useSession();

  const handleNewLog = useCallback((log: SignalLog) => {
    addLog(log);
  }, [addLog]);

  const { isActive, currentSignal, stability, toggle } = useSignalLogger(handleNewLog, activeSession?._id);

  // Default filter to user's carrier on first signal detection
  React.useEffect(() => {
    if (currentSignal?.carrier && currentSignal.carrier !== 'Unknown') {
      setDefaultCarrier(currentSignal.carrier);
    }
  }, [currentSignal?.carrier, setDefaultCarrier]);

  const { inDeadZone, deadZoneReason, processReading } = useDeadZone();

  // Feed signal readings to dead zone detector. Passes the Phase 1 `validated` hint
  // so the detector can distinguish NO_SIGNAL from NO_INTERNET and alert accordingly.
  React.useEffect(() => {
    if (currentSignal) {
      processReading({
        dbm: currentSignal.signal.dbm,
        validated: currentSignal.signal.validated,
        networkType: currentSignal.networkType,
      });
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
          if (dotTooltip && dotTooltip.id === data.id && data.isConsolidated) {
            // Second tap on consolidated dot — show Signal Summary
            // Snapshot the item now so it survives viewport changes
            const item = consolidated.find((c: any) => c._id === data.id);
            dotDetailItemRef.current = item || null;
            setDotDetail(data);
            setDotTooltip(null);
            setSelectedReadingIdx(null);
            setShowAllReadings(false);
            webViewRef.current?.injectJavaScript('hideTooltip(); true;');

            // Save map state, hide dots, hide bottom sheet
            webViewRef.current?.injectJavaScript(`
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapState', ...JSON.parse(getMapState()) }));
              hideDots();
              true;
            `);
            setSummaryOpen(true);

            const c = consolidated.find((r: any) => r._id === data.id);
            if (c?.readingIds?.length) {
              fetchReadings(c._id, c.readingIds);
            }
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
        } else if (data.type === 'mapState') {
          savedMapState.current = { lat: data.lat, lng: data.lng, zoom: data.zoom };
        } else if (data.type === 'mapTap') {
          // Dismiss tooltip/detail on any map tap
          if (dotTooltip || dotDetail) {
            setDotTooltip(null);
            setDotDetail(null);
            dotDetailItemRef.current = null;
            setSummaryOpen(false);
            setSelectedReadingIdx(null);
            setShowAllReadings(false);
            clearBreakdown();
            if (savedMapState.current) {
              const { lat, lng, zoom } = savedMapState.current;
              webViewRef.current?.injectJavaScript(`restoreMapState(${lat},${lng},${zoom}); true;`);
              savedMapState.current = null;
            }
            webViewRef.current?.injectJavaScript('hideTooltip(); true;');
          } else if (compareMode) {
            setCompareCoords([data.lng, data.lat]);
            setCompareVisible(true);
          }
        }
      } catch {}
    },
    [fetchData, filters, compareMode, dotTooltip, dotDetail, signals, consolidated, fetchReadings, clearBreakdown],
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

    // Don't touch dots when signal summary is open (ungrouped reading dots control the map)
    if (summaryOpen) return;

    let js = 'clearOverlays();';

    // Hide dots/heatmap when viewing a session detail (only trail shows)
    if (selectedSession) {
      webViewRef.current.injectJavaScript(js + 'true;');
      return;
    }

    // Heatmap toggle is the master switch — OFF = clean map
    // Don't show heatmap during dead zone
    if (heatmapVisible && !inDeadZone) {
      const zoom = lastViewport.current?.zoom ?? 14;

      // Zoom-based rendering: individual dots only at zoom >= 16
      if (zoom >= 16) {
        const maxFresh = 200;
        signals.slice(0, maxFresh).forEach((sig) => {
          const color = getSignalColor(sig.signal.dbm);
          // Phase 1: flag NO_INTERNET readings (signal present, Android says internet broken)
          // so the WebView adds a visible orange ring around these dots.
          const noInternet = sig.signal.validated === false ? 1 : 0;
          js += `addMarker(${sig.location.coordinates[1]},${sig.location.coordinates[0]},'${color}','${sig._id}',${noInternet});`;
        });
      }

      // Consolidated dots at zoom >= 13 (hidden at city-level zoom — heatmap only)
      if (zoom >= 13) {
        const maxCons = zoom >= 16 ? 200 : 50;
        consolidated.slice(0, maxCons).forEach((c) => {
          const color = getSignalColor(c.avgDbm);
          js += `addConsolidatedMarker(${c.location.coordinates[1]},${c.location.coordinates[0]},'${color}',${c.count},'${c._id}');`;
        });
      }

      // Heatmap tiles at low zoom
      if (zoom < 16) {
        heatmapTiles.forEach((tile) => {
          const color = getSignalColor(tile.avgDbm);
          const lat = (tile.swLat + tile.neLat) / 2;
          const lng = (tile.swLng + tile.neLng) / 2;
          js += `addHeatCircle(${lat},${lng},300,'${color}');`;
        });
      }
    }

    webViewRef.current.injectJavaScript(js + 'true;');
  }, [signals, consolidated, heatmapTiles, heatmapVisible, inDeadZone, selectedSession, summaryOpen]);

  // Update overlays when data changes
  React.useEffect(() => {
    updateOverlays();
  }, [updateOverlays]);

  // Show ungrouped readings on map when breakdown loads
  React.useEffect(() => {
    if (!summaryOpen || breakdownReadings.length === 0 || !webViewRef.current) return;
    const readings = breakdownReadings.map((r: any, idx: number) => {
      const dbm = r.signal?.dbm ?? r.dbm;
      const coords = r.location?.coordinates;
      return {
        idx,
        lat: coords?.[1] || 0,
        lng: coords?.[0] || 0,
        color: getSignalColor(dbm),
      };
    }).filter((r: any) => r.lat !== 0 && r.lng !== 0);
    webViewRef.current.injectJavaScript(`showUngroupedReadings(${JSON.stringify(readings)}); true;`);
  }, [breakdownReadings, summaryOpen]);

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
        <DeadZoneBanner visible={true} reason={deadZoneReason} />
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
      {!summaryOpen && (
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
      )}

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
            {/* Handle bar */}
            <View style={{ alignItems: 'center', paddingBottom: 8 }}>
              <View style={{ width: 36, height: 4, backgroundColor: '#374151', borderRadius: 2 }} />
            </View>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <View style={styles.dotDetailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dotDetailTitle}>{dotDetail.isConsolidated ? 'Signal Summary' : 'Signal Reading'}</Text>
                <Text style={styles.dotDetailSub}>
                  {(() => {
                    const item = dotDetailItemRef.current;
                    if (!item) return '';
                    return dotDetail.isConsolidated
                      ? `${item.carrier} · ${item.networkType} · ${item.count} readings`
                      : `${item.carrier} · ${item.networkType}`;
                  })()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {(() => {
                  const item = dotDetailItemRef.current;
                  const dbm = item ? (dotDetail.isConsolidated ? item.avgDbm : item.signal?.dbm) : 0;
                  return (
                    <>
                      <Text style={[styles.dotDetailDbm, { color: getSignalColor(dbm) }]}>{dbm}</Text>
                      <Text style={styles.dotDetailDbmLabel}>{dotDetail.isConsolidated ? 'avg dBm' : 'dBm'}</Text>
                    </>
                  );
                })()}
              </View>
            </View>
            {/* Phase 1 — freshness + validated ratio strip */}
            {(() => {
              const item = dotDetailItemRef.current;
              if (!item) return null;
              const ts = dotDetail.isConsolidated
                ? (item.lastTimestamp || item.updatedAt)
                : item.timestamp;
              const freshLabel = ts ? formatRelative(ts) : null;

              // Validated ratio — count breakdown readings that had validated=true
              // vs total that had the field. Only meaningful once Phase 1 data exists.
              let validatedLabel: string | null = null;
              if (dotDetail.isConsolidated && breakdownReadings.length > 0) {
                const withField = breakdownReadings.filter(
                  (r: any) => typeof r.signal?.validated === 'boolean',
                );
                if (withField.length > 0) {
                  const okCount = withField.filter((r: any) => r.signal.validated === true).length;
                  validatedLabel = `${okCount}/${withField.length} validated`;
                }
              } else if (!dotDetail.isConsolidated) {
                // Single reading — show explicit state if we have it
                if (item.signal?.validated === true) validatedLabel = 'Internet OK';
                else if (item.signal?.validated === false) validatedLabel = 'No internet';
              }

              if (!freshLabel && !validatedLabel) return null;
              return (
                <View style={styles.freshnessStrip}>
                  {freshLabel && (
                    <Text style={styles.freshnessText}>
                      {'\u23F1 '}Updated {freshLabel}
                    </Text>
                  )}
                  {validatedLabel && (
                    <Text
                      style={[
                        styles.validatedBadge,
                        validatedLabel.includes('No internet') && styles.validatedBadgeBad,
                      ]}
                    >
                      {validatedLabel.includes('No internet') ? '\u26A0 ' : '\u2713 '}
                      {validatedLabel}
                    </Text>
                  )}
                </View>
              );
            })()}
            {dotDetail.isConsolidated && (() => {
              const c = dotDetailItemRef.current;
              if (!c) return null;
              return (
                <View style={styles.dotDetailRange}>
                  <View style={styles.dotDetailRangeLabels}>
                    <Text style={[styles.dotDetailRangeText, { color: '#22C55E' }]}>Best: {c.maxDbm}</Text>
                    <Text style={[styles.dotDetailRangeText, { color: '#EF4444' }]}>Worst: {c.minDbm}</Text>
                  </View>
                  <View style={styles.dotDetailBar}>
                    <View style={styles.dotDetailBarGradient} />
                    {selectedReadingIdx !== null && breakdownReadings[selectedReadingIdx] && (() => {
                      const selDbm = breakdownReadings[selectedReadingIdx].signal?.dbm ?? breakdownReadings[selectedReadingIdx].dbm;
                      const markerPos = Math.max(0, Math.min(1, (selDbm + 120) / 70)) * 100;
                      return (
                        <View style={[styles.rangeMarker, { left: `${markerPos}%` }]} />
                      );
                    })()}
                  </View>
                </View>
              );
            })()}
            {dotDetail.isConsolidated && (
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownLabel}>SIGNAL BREAKDOWN</Text>
                {breakdownLoading ? (
                  <>
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={styles.skeletonRow}>
                        <View style={[styles.skeletonBlock, { width: 65 }]} />
                        <View style={[styles.skeletonBlock, { flex: 1, marginHorizontal: 8 }]} />
                        <View style={[styles.skeletonBlock, { width: 32 }]} />
                      </View>
                    ))}
                  </>
                ) : breakdownError ? (
                  <Text style={styles.breakdownErrorText}>Readings unavailable offline</Text>
                ) : (
                  <>
                    <ScrollView style={showAllReadings ? { maxHeight: 200 } : undefined} nestedScrollEnabled>
                      {(showAllReadings ? breakdownReadings.slice(0, 50) : breakdownReadings.slice(0, 5)).map((reading: any, idx: number) => {
                        const dbm = reading.signal?.dbm ?? reading.dbm;
                        const color = getSignalColor(dbm);
                        const normalized = Math.max(0, Math.min(1, (dbm + 120) / 70)) * 100;
                        const activity = getActivityLevel(dbm);
                        const isSelected = selectedReadingIdx === idx;
                        const hasCoords = reading.location?.coordinates?.length === 2;
                        const ts = new Date(reading.timestamp);
                        const timeLabel = `${ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

                        return (
                          <View
                            key={reading._id || idx}
                            style={[
                              styles.breakdownRow,
                              idx < (showAllReadings ? Math.min(breakdownReadings.length, 50) : Math.min(breakdownReadings.length, 5)) - 1 && styles.breakdownRowBorder,
                              isSelected && styles.breakdownRowSelected,
                            ]}
                            onTouchEnd={hasCoords ? () => {
                              setSelectedReadingIdx(idx);
                              const [lng, lat] = reading.location.coordinates;
                              webViewRef.current?.injectJavaScript(
                                `highlightUngroupedReading(${idx},${lat},${lng},'${color}'); true;`
                              );
                            } : undefined}
                          >
                            <Text style={[styles.breakdownTime, isSelected && { color: '#93C5FD' }]}>{timeLabel}</Text>
                            <View style={styles.breakdownBarWrap}>
                              <View style={[styles.breakdownBar, { width: `${normalized}%`, backgroundColor: color }]} />
                            </View>
                            <Text style={[styles.breakdownDbm, { color }]}>{dbm}</Text>
                            <Text style={[styles.breakdownBadge, { color: activity.color, backgroundColor: `${activity.color}15` }]}>
                              {ACTIVITY_SHORT[activity.level]}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                    {!showAllReadings && breakdownReadings.length > 5 && (
                      <View style={styles.showAllBtn} onTouchEnd={() => setShowAllReadings(true)}>
                        <Text style={styles.showAllText}>Show all ({breakdownReadings.length})</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
            </ScrollView>
            <View style={styles.dotDetailClose} onTouchEnd={() => {
              setDotDetail(null);
              dotDetailItemRef.current = null;
              setSummaryOpen(false);
              setSelectedReadingIdx(null);
              setShowAllReadings(false);
              clearBreakdown();
              if (savedMapState.current) {
                const { lat, lng, zoom } = savedMapState.current;
                webViewRef.current?.injectJavaScript(`restoreMapState(${lat},${lng},${zoom}); true;`);
                savedMapState.current = null;
              }
            }}>
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
  dotDetailOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.round(Dimensions.get('window').height * 0.55), borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  dotDetailCard: { backgroundColor: '#111827', flex: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  dotDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dotDetailTitle: { color: '#F9FAFB', fontSize: 15, fontWeight: 'bold' },
  dotDetailSub: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  dotDetailDbm: { fontSize: 22, fontWeight: 'bold' },
  dotDetailDbmLabel: { color: '#9CA3AF', fontSize: 9 },
  freshnessStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, paddingHorizontal: 2 },
  freshnessText: { color: '#94A3B8', fontSize: 11 },
  validatedBadge: { color: '#4ADE80', fontSize: 10, backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', fontWeight: '600' },
  validatedBadgeBad: { color: '#FB923C', backgroundColor: 'rgba(251,146,60,0.15)' },
  dotDetailRange: { backgroundColor: '#1F2937', borderRadius: 8, padding: 10, marginBottom: 12 },
  dotDetailRangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dotDetailRangeText: { fontSize: 10 },
  dotDetailBar: { height: 6, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  dotDetailBarGradient: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EAB308' },
  dotDetailClose: { padding: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1F2937', marginTop: 4 },
  dotDetailCloseText: { color: '#9CA3AF', fontSize: 13 },

  // Breakdown section
  breakdownSection: { marginBottom: 12 },
  breakdownLabel: { color: '#6B7280', fontSize: 10, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 6 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  breakdownRowBorder: { borderBottomWidth: 1, borderBottomColor: '#293548' },
  breakdownRowSelected: { backgroundColor: 'rgba(59,130,246,0.15)', borderLeftWidth: 3, borderLeftColor: '#3B82F6' },
  breakdownTime: { color: '#6B7280', fontSize: 10, width: 80 },
  breakdownBarWrap: { flex: 1, height: 4, backgroundColor: '#293548', borderRadius: 2, marginHorizontal: 6, overflow: 'hidden' },
  breakdownBar: { height: 4, borderRadius: 2 },
  breakdownDbm: { fontSize: 12, fontWeight: '700', width: 34, textAlign: 'right' as const },
  breakdownBadge: { fontSize: 8, fontWeight: '600', paddingVertical: 1, paddingHorizontal: 5, borderRadius: 4, marginLeft: 6, overflow: 'hidden' },
  breakdownErrorText: { color: '#6B7280', fontSize: 12, textAlign: 'center' as const, paddingVertical: 16 },
  showAllBtn: { paddingVertical: 8, alignItems: 'center' as const },
  showAllText: { color: '#6B7280', fontSize: 11 },

  // Skeleton loading rows
  skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10 },
  skeletonBlock: { height: 10, backgroundColor: '#1F2937', borderRadius: 4, opacity: 0.6 },

  // Range bar marker
  rangeMarker: { position: 'absolute', top: -3, width: 2, height: 12, backgroundColor: '#FFFFFF', borderRadius: 1 },
});
