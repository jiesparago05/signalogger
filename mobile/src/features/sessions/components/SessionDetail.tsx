import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { api } from '../../../lib/api/client';
import { getSignalColor } from '../../../lib/config';
import { MappingSession } from '../../../types/signal';

interface SessionDetailProps {
  session: MappingSession;
  onBack: () => void;
  onDrawTrail: (trail: { lat: number; lng: number; color: string }[]) => void;
  onClearTrail: () => void;
  onSaveAsRoute: () => void;
}

export function SessionDetail({ session, onBack, onDrawTrail, onClearTrail, onSaveAsRoute }: SessionDetailProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session._id) return;
    (async () => {
      try {
        const res = await api.sessions.getTrail(session._id!);
        const trailPoints = (res.data || []).map((log: any) => {
          const [lng, lat] = log.location.coordinates;
          return { lat, lng, color: getSignalColor(log.signal.dbm) };
        });
        onDrawTrail(trailPoints);
      } catch (err) {
        console.warn('Failed to load trail:', err);
      } finally {
        setLoading(false);
      }
    })();

    return () => onClearTrail();
  }, [session._id]);

  const start = new Date(session.startTime);
  const end = session.endTime ? new Date(session.endTime) : null;
  const durationMin = end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
  const distKm = (session.distanceMeters / 1000).toFixed(1);
  const signalColor = getSignalColor(session.avgDbm);
  const title = session.startLocationName && session.endLocationName
    ? `${session.startLocationName.split(',')[0]} → ${session.endLocationName.split(',')[0]}`
    : `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} session`;

  return (
    <View style={styles.container}>
      <View style={styles.backBtn} onTouchEnd={onBack}>
        <Text style={styles.backText}>{'\u2190'} Back to Sessions</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><Text style={styles.muted}>Loading trail...</Text></View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {start.toLocaleDateString([], { month: 'short', day: 'numeric' })} {'\u00B7'} {durationMin} min {'\u00B7'} {distKm} km {'\u00B7'} {session.logCount} logs
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={[styles.headerDbm, { color: signalColor }]}>{session.avgDbm}</Text>
              <Text style={styles.headerDbmLabel}>avg dBm</Text>
            </View>
          </View>

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
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoText}>{session.carrier} {'\u00B7'} {session.networkType} {'\u00B7'} {session.stability}</Text>
          </View>
        </ScrollView>
      )}

      {/* Save as Route button */}
      {!session.routeId && (
        <View style={styles.bottomBtn} onTouchEnd={onSaveAsRoute}>
          <Text style={styles.bottomBtnText}>{'\uD83D\uDCCD'} Save as Route</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(17,24,39,0.95)' },
  backBtn: { padding: 16, paddingTop: 12 },
  backText: { color: '#22C55E', fontSize: 14, fontWeight: '600' },
  loadingWrap: { alignItems: 'center', paddingVertical: 30 },
  muted: { color: '#9CA3AF', fontSize: 13 },
  content: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerLeft: { flex: 1 },
  title: { color: '#F9FAFB', fontSize: 16, fontWeight: 'bold' },
  subtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerDbm: { fontSize: 24, fontWeight: 'bold' },
  headerDbmLabel: { color: '#9CA3AF', fontSize: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, backgroundColor: '#1F2937', borderRadius: 12, borderWidth: 1, borderColor: '#374151', marginBottom: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#9CA3AF', fontSize: 10, marginTop: 2 },
  infoRow: { alignItems: 'center', paddingVertical: 8 },
  infoText: { color: '#9CA3AF', fontSize: 12 },
  bottomBtn: { backgroundColor: '#22C55E', margin: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  bottomBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
