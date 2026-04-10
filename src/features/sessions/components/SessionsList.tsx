import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../../lib/api/client';
import { getDeviceId } from '../../../lib/config/device';
import { getSignalColor } from '../../../lib/config';
import { APP_VERSION } from '../../../lib/config/app-version';
import { MappingSession } from '../../../types/signal';

const SESSIONS_KEY = '@signalog_sessions';

interface SessionsListProps {
  onSelectSession: (session: MappingSession) => void;
  isMapping?: boolean;
}

export function SessionsList({ onSelectSession, isMapping }: SessionsListProps) {
  const [sessions, setSessions] = useState<MappingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Load local first (instant)
        const raw = await AsyncStorage.getItem(SESSIONS_KEY);
        const rawLocal: MappingSession[] = raw ? JSON.parse(raw) : [];
        // Drop orphan/partial sessions (missing startTime — created by an old race bug)
        const local = rawLocal.filter((s) => !!s.startTime);
        if (local.length !== rawLocal.length) {
          await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(local.slice(0, 50))).catch(() => {});
        }
        if (local.length > 0) {
          setSessions(local);
          setLoading(false);
        }

        // Fetch server in background, merge
        const deviceId = await getDeviceId();
        api.sessions.listByDevice(deviceId).then((res) => {
          if (res.data && res.data.length > 0) {
            const merged = new Map<string, MappingSession>();
            for (const s of local) merged.set(s._id, s);
            for (const s of res.data) merged.set(s._id, s);
            const sorted = Array.from(merged.values()).sort(
              (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
            );
            setSessions(sorted);
            AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sorted.slice(0, 50))).catch(() => {});
          }
        }).catch(() => {});
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

  const completedSessions = sessions.filter((s) => s.status !== 'active');
  const showMappingIndicator = isMapping;

  return (
    <ScrollView style={styles.container}>
      {showMappingIndicator && (
        <View style={[styles.card, styles.activeCard]}>
          <View style={styles.cardTop}>
            <View style={styles.cardLeft}>
              <View style={styles.activeRow}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Mapping in progress...</Text>
              </View>
            </View>
          </View>
        </View>
      )}
      {completedSessions.map((session) => {
        const color = getSignalColor(session.avgDbm ?? 0);
        const start = session.startTime ? new Date(session.startTime) : null;
        const end = session.endTime ? new Date(session.endTime) : null;
        const isValidStart = start && !isNaN(start.getTime());
        const isValidEnd = end && !isNaN(end.getTime());
        const dateStr = isValidStart ? start!.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—';
        const timeStr = isValidStart ? start!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
        const endTimeStr = isValidEnd ? end!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';
        const distKm = ((session.distanceMeters ?? 0) / 1000).toFixed(1);
        const carrierLabel = session.carrier || '—';
        const networkLabel = session.networkType || '—';

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
                  {session.startLocationName ? `${dateStr} · ` : ''}{distKm} km · {carrierLabel} · {networkLabel}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.cardDbm, { color }]}>{session.avgDbm ?? '—'}</Text>
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
      <View style={styles.footer}>
        <Text style={styles.footerText}>Signalog v{APP_VERSION}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 4 },
  center: { alignItems: 'center', paddingVertical: 20 },
  muted: { color: '#9CA3AF', fontSize: 13 },
  card: { backgroundColor: '#1F2937', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#374151' },
  activeCard: { borderColor: '#22C55E', borderWidth: 1.5 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  activeText: { color: '#4ADE80', fontSize: 14, fontWeight: '600' },
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
  footer: { alignItems: 'center', paddingVertical: 16, paddingBottom: 32 },
  footerText: { color: '#4B5563', fontSize: 10, fontFamily: 'monospace', letterSpacing: 0.5 },
});
