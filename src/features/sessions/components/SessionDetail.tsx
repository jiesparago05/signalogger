import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { api } from '../../../lib/api/client';
import { getSignalColor } from '../../../lib/config';
import { getLogsByTimeRange, getLogsBySessionId } from '../../offline-sync/services/log-store';
import { MappingSession, SignalLog } from '../../../types/signal';

interface SessionDetailProps {
  session: MappingSession;
  onBack: () => void;
  onDrawTrail: (trail: { lat: number; lng: number; color: string }[]) => void;
  onClearTrail: () => void;
  onSaveAsRoute: () => void;
  onHighlightReading?: (lat: number, lng: number, color: string) => void;
}

export function SessionDetail({ session, onBack, onDrawTrail, onClearTrail, onSaveAsRoute, onHighlightReading }: SessionDetailProps) {
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<SignalLog[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!session._id) return;

    const toTrailPoints = (logs: any[]) =>
      logs
        .filter((l: any) => l.location?.coordinates)
        .map((l: any) => {
          const [lng, lat] = l.location.coordinates;
          return { lat, lng, color: '#3B82F6', ts: new Date(l.timestamp).getTime() };
        });

    (async () => {
      // Load local logs — try sessionId first, fall back to time range
      let sessionLogs: SignalLog[] = [];

      if (session._id) {
        sessionLogs = await getLogsBySessionId(session._id);
      }

      // Fallback: time range query (for older sessions without sessionId)
      if (sessionLogs.length === 0 && session.startTime && session.endTime) {
        const localLogs = await getLogsByTimeRange(
          new Date(session.startTime),
          new Date(session.endTime),
        );
        sessionLogs = localLogs
          .filter((l) => !session.deviceId || l.deviceId === session.deviceId)
          .slice(0, session.logCount || localLogs.length);
      }

      if (sessionLogs.length > 0) {
        onDrawTrail(toTrailPoints(sessionLogs));
        setReadings(sessionLogs);
        setLoading(false);
      }

      // Fetch server trail in background (may have more data)
      if (session._id && !session._id.startsWith('local_')) {
        api.sessions.getTrail(session._id).then((res) => {
          if (res.data && res.data.length > 0) {
            onDrawTrail(toTrailPoints(res.data));
            // Only replace readings if they have sessionId or logCount matches
            const capped = session.logCount
              ? res.data.slice(0, session.logCount)
              : res.data;
            setReadings(capped);
          }
        }).catch(() => {});
      }

      setLoading(false);
    })();

    return () => onClearTrail();
  }, [session._id]);

  const start = new Date(session.startTime);
  const end = session.endTime ? new Date(session.endTime) : null;
  const durationMin = end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
  const distKm = (session.distanceMeters / 1000).toFixed(1);
  const signalColor = getSignalColor(session.avgDbm);
  const title = session.startLocationName && session.endLocationName
    ? `${session.startLocationName.split(',')[0]} \u2192 ${session.endLocationName.split(',')[0]}`
    : `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} session`;

  const getBarWidth = (dbm: number): number => {
    // 0 dBm = 100%, -130 dBm = 0%
    return Math.max(0, Math.min(100, ((dbm + 130) / 130) * 100));
  };

  const visibleReadings = readings.slice(0, visibleCount);
  const hasMore = readings.length > visibleCount;
  const remaining = readings.length - visibleCount;

  return (
    <View style={styles.container}>
      <View style={styles.backBtn} onTouchEnd={onBack}>
        <Text style={styles.backText}>{'\u2190'} Sessions</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Trip Summary label */}
        <Text style={styles.sectionLabel}>Trip Summary</Text>

        {/* Title + avg dBm */}
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

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: getSignalColor(session.maxDbm) }]}>{session.maxDbm}</Text>
            <Text style={styles.statLabel}>Best</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: getSignalColor(session.avgDbm) }]}>{session.avgDbm}</Text>
            <Text style={styles.statLabel}>Avg</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: getSignalColor(session.minDbm) }]}>{session.minDbm}</Text>
            <Text style={styles.statLabel}>Worst</Text>
          </View>
        </View>

        {/* Chips */}
        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{session.carrier}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{session.networkType}</Text>
          </View>
          <View style={[styles.chip, styles.stabilityChip]}>
            <Text style={[styles.chipText, {
              color: session.stability === 'Stable' ? '#4ADE80' : session.stability === 'Fluctuating' ? '#EAB308' : '#EF4444',
            }]}>
              {session.stability === 'Fluctuating' ? '\u26A0 ' : ''}{session.stability}
            </Text>
          </View>
        </View>

        {/* Signal Readings */}
        {readings.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Signal Readings</Text>
            <View style={styles.readingsCard}>
              {visibleReadings.map((log, idx) => {
                const dbm = log.signal.dbm;
                const color = getSignalColor(dbm);
                const barWidth = getBarWidth(dbm);
                const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isLast = idx === visibleReadings.length - 1 && !hasMore;
                const isSelected = selectedIdx === idx;
                const hasCoords = log.location?.coordinates?.length === 2;
                return (
                  <View
                    key={log._id || idx}
                    style={[styles.readingRow, !isLast && styles.readingBorder, isSelected && styles.readingSelected]}
                    onTouchEnd={hasCoords ? () => {
                      setSelectedIdx(idx);
                      const [lng, lat] = log.location.coordinates;
                      onHighlightReading?.(lat, lng, color);
                    } : undefined}
                  >
                    <Text style={styles.readingTime}>{time}</Text>
                    <View style={styles.readingBarWrap}>
                      <View style={[styles.readingBar, { width: `${barWidth}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.readingDbm, { color }]}>{dbm}</Text>
                  </View>
                );
              })}
            </View>

            {hasMore && (
              <View style={styles.loadMoreBtn} onTouchEnd={() => setVisibleCount((c) => c + 20)}>
                <Text style={styles.loadMoreText}>Load More ({remaining} remaining)</Text>
              </View>
            )}
          </>
        )}

        {/* Save as Route */}
        {!session.routeId && (
          <View style={styles.saveBtn} onTouchEnd={onSaveAsRoute}>
            <Text style={styles.saveBtnText}>{'\uD83D\uDCCD'} Save as Route</Text>
          </View>
        )}

        {/* Bottom padding for scroll */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(17,24,39,0.95)' },
  backBtn: { padding: 16, paddingTop: 12, paddingBottom: 8 },
  backText: { color: '#22C55E', fontSize: 13, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 16 },
  sectionLabel: { color: '#6B7280', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerLeft: { flex: 1 },
  title: { color: '#F9FAFB', fontSize: 15, fontWeight: 'bold' },
  subtitle: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerDbm: { fontSize: 22, fontWeight: 'bold' },
  headerDbmLabel: { color: '#9CA3AF', fontSize: 9 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    marginBottom: 8,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: 'bold' },
  statLabel: { color: '#9CA3AF', fontSize: 9, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: '#374151' },
  chipsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 4 },
  chip: { backgroundColor: '#1F2937', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stabilityChip: { backgroundColor: 'rgba(234,179,8,0.1)' },
  chipText: { color: '#9CA3AF', fontSize: 10 },
  readingsCard: { backgroundColor: '#1F2937', borderRadius: 10, overflow: 'hidden' },
  readingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12 },
  readingBorder: { borderBottomWidth: 1, borderBottomColor: '#293548' },
  readingSelected: { backgroundColor: 'rgba(59,130,246,0.15)' },
  readingTime: { color: '#6B7280', fontSize: 11, width: 62 },
  readingBarWrap: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#293548', marginHorizontal: 10, overflow: 'hidden' },
  readingBar: { height: 4, borderRadius: 2 },
  readingDbm: { fontSize: 12, fontWeight: 'bold', width: 40, textAlign: 'right' },
  loadMoreBtn: { padding: 12, alignItems: 'center' },
  loadMoreText: { color: '#9CA3AF', fontSize: 12 },
  saveBtn: { backgroundColor: '#22C55E', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 14 },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
