import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../../../lib/api/client';
import { getSignalColor } from '../../../lib/config';
import { SignalChart } from './SignalChart';
import { MappingSession, SignalLog } from '../../../types/signal';

interface SessionDetailProps {
  session: MappingSession;
  onBack: () => void;
}

export function SessionDetail({ session, onBack }: SessionDetailProps) {
  const [trail, setTrail] = useState<SignalLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session._id) return;
    (async () => {
      try {
        const res = await api.sessions.getTrail(session._id!);
        setTrail(res.data);
      } catch (err) {
        console.warn('Failed to load trail:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [session._id]);

  const chartData = trail.map(log => ({
    time: new Date(log.timestamp).getTime(),
    dbm: log.signal.dbm,
  }));

  const trailPoints = trail.map(log => {
    const [lng, lat] = log.location.coordinates;
    return { lat, lng, color: getSignalColor(log.signal.dbm) };
  });

  const centerLat = trailPoints.length > 0 ? trailPoints.reduce((s, p) => s + p.lat, 0) / trailPoints.length : 14.55;
  const centerLng = trailPoints.length > 0 ? trailPoints.reduce((s, p) => s + p.lng, 0) / trailPoints.length : 121.0;

  const polylineJS = trailPoints.slice(1).map((p, i) => {
    const prev = trailPoints[i];
    return `L.polyline([[${prev.lat},${prev.lng}],[${p.lat},${p.lng}]],{color:'${p.color}',weight:5,opacity:0.8}).addTo(map);`;
  }).join('');

  const mapHtml = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0;}#map{width:100vw;height:100vh;}.leaflet-control-attribution{display:none!important;}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:false}).setView([${centerLat},${centerLng}],15);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
${polylineJS}
${trailPoints.length > 0 ? `L.circleMarker([${trailPoints[0].lat},${trailPoints[0].lng}],{radius:6,fillColor:'#22C55E',fillOpacity:1,stroke:true,color:'#fff',weight:2}).addTo(map);
L.circleMarker([${trailPoints[trailPoints.length - 1].lat},${trailPoints[trailPoints.length - 1].lng}],{radius:6,fillColor:'#EF4444',fillOpacity:1,stroke:true,color:'#fff',weight:2}).addTo(map);` : ''}
</script></body></html>`;

  const start = new Date(session.startTime);

  return (
    <View style={styles.container}>
      <View style={styles.backBtn} onTouchEnd={onBack}>
        <Text style={styles.backText}>{'\u2190'} Back</Text>
      </View>

      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loadingMap}><Text style={styles.muted}>Loading trail...</Text></View>
        ) : (
          <WebView source={{ html: mapHtml }} style={styles.map} scrollEnabled={false} originWhitelist={['*']} />
        )}
      </View>

      <ScrollView style={styles.details}>
        <Text style={styles.title}>{start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        <Text style={styles.subtitle}>{session.carrier} {'\u00B7'} {session.networkType} {'\u00B7'} {(session.distanceMeters / 1000).toFixed(1)} km</Text>

        {chartData.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signal Over Time</Text>
            <SignalChart data={chartData} />
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: getSignalColor(session.maxDbm) }]}>{session.maxDbm}</Text>
            <Text style={styles.statLabel}>Best</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: getSignalColor(session.avgDbm) }]}>{session.avgDbm}</Text>
            <Text style={styles.statLabel}>Average</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: getSignalColor(session.minDbm) }]}>{session.minDbm}</Text>
            <Text style={styles.statLabel}>Worst</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{session.logCount}</Text>
            <Text style={styles.statLabel}>Logs</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  backBtn: { padding: 16, paddingTop: 48 },
  backText: { color: '#22C55E', fontSize: 16, fontWeight: '600' },
  mapContainer: { height: 250 },
  loadingMap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F2937' },
  map: { flex: 1 },
  muted: { color: '#9CA3AF', fontSize: 13 },
  details: { flex: 1, padding: 20 },
  title: { color: '#F9FAFB', fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  section: { marginTop: 20 },
  sectionTitle: { color: '#F9FAFB', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, paddingVertical: 16, backgroundColor: '#1F2937', borderRadius: 12, borderWidth: 1, borderColor: '#374151' },
  stat: { alignItems: 'center' },
  statValue: { color: '#F9FAFB', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#9CA3AF', fontSize: 10, marginTop: 2 },
});
