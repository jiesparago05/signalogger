import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { api } from '../../../lib/api/client';
import { getDeviceId } from '../../../lib/config/device';
import { getSignalColor } from '../../../lib/config';
import { MappingSession } from '../../../types/signal';

interface SessionsListProps {
  onSelectSession: (session: MappingSession) => void;
}

export function SessionsList({ onSelectSession }: SessionsListProps) {
  const [sessions, setSessions] = useState<MappingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const deviceId = await getDeviceId();
        const res = await api.sessions.listByDevice(deviceId);
        setSessions(res.data);
      } catch (err) {
        console.warn('Failed to load sessions:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <View style={styles.center}><Text style={styles.muted}>Loading sessions...</Text></View>;
  }

  if (sessions.length === 0) {
    return <View style={styles.center}><Text style={styles.muted}>No sessions yet. Start mapping!</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      {sessions.map((session) => {
        const color = getSignalColor(session.avgDbm);
        const start = new Date(session.startTime);
        const end = session.endTime ? new Date(session.endTime) : null;
        const dateStr = start.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTimeStr = end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';
        const distKm = (session.distanceMeters / 1000).toFixed(1);

        return (
          <View key={session._id} style={styles.card} onTouchEnd={() => onSelectSession(session)}>
            <View style={styles.cardTop}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardTitle}>
                  {session.startLocationName && session.endLocationName
                    ? `${session.startLocationName.split(',')[0]} → ${session.endLocationName.split(',')[0]}`
                    : `${dateStr}, ${timeStr} — ${endTimeStr}`}
                </Text>
                <Text style={styles.cardInfo}>
                  {session.startLocationName ? `${dateStr} · ` : ''}{distKm} km · {session.carrier} · {session.networkType}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.cardDbm, { color }]}>{session.avgDbm}</Text>
                <Text style={styles.cardDbmLabel}>avg dBm</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.badge}>{session.logCount} logs</Text>
              <Text style={[styles.stabilityBadge, {
                color: session.stability === 'Stable' ? '#4ADE80' : session.stability === 'Fluctuating' ? '#EAB308' : '#EF4444',
              }]}>{session.stability}</Text>
              {session.routeId ? (
                <Text style={styles.routeSaved}>{'\u2705'} Route saved</Text>
              ) : (
                <Text style={styles.routeUnsaved}>{'\uD83D\uDCCD'} Not saved</Text>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 4 },
  center: { alignItems: 'center', paddingVertical: 20 },
  muted: { color: '#9CA3AF', fontSize: 13 },
  card: { backgroundColor: '#1F2937', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#374151' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#F9FAFB', fontSize: 14, fontWeight: '600' },
  cardLeft: { flex: 1 },
  cardInfo: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardDbm: { fontSize: 18, fontWeight: 'bold' },
  cardDbmLabel: { color: '#9CA3AF', fontSize: 10 },
  cardBottom: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  badge: { color: '#4ADE80', fontSize: 10, backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  stabilityBadge: { fontSize: 10, backgroundColor: 'rgba(234,179,8,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  range: { color: '#9CA3AF', fontSize: 10 },
  routeSaved: { color: '#22C55E', fontSize: 10, marginLeft: 'auto' },
  routeUnsaved: { color: '#9CA3AF', fontSize: 10, marginLeft: 'auto' },
});
