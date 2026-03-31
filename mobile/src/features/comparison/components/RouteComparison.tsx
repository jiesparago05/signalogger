import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useComparison } from '../hooks/use-comparison';
import { getCarrierColor } from '../../../lib/config';

interface RouteComparisonProps {
  routeId: string;
  routeName: string;
  onBack: () => void;
}

const ACTIVITY_COLORS: Record<string, string> = {
  gaming: '#22C55E',
  streaming: '#84CC16',
  browsing: '#EAB308',
  messaging: '#F97316',
  dead: '#EF4444',
};

const ACTIVITY_SHORT: Record<string, string> = {
  gaming: 'Game',
  streaming: 'Stream',
  browsing: 'Browse',
  messaging: 'Msg',
  dead: 'Dead',
};

export function RouteComparison({ routeId, routeName, onBack }: RouteComparisonProps) {
  const { routeData, loading, compareRoute } = useComparison();
  const [showSegments, setShowSegments] = useState(true);

  useEffect(() => {
    compareRoute(routeId);
  }, [routeId, compareRoute]);

  if (loading || !routeData) {
    return (
      <View style={styles.container}>
        <View style={styles.backBtn} onTouchEnd={onBack}>
          <Text style={styles.backText}>{'\u2190'} Back</Text>
        </View>
        <View style={styles.center}><Text style={styles.muted}>Loading comparison...</Text></View>
      </View>
    );
  }

  const { ranking, segments, totalDataPoints } = routeData;
  const winner = ranking[0];
  const runners = ranking.slice(1);
  const allCarriers = ranking.map(r => r.carrier);

  return (
    <View style={styles.container}>
      <View style={styles.backBtn} onTouchEnd={onBack}>
        <Text style={styles.backText}>{'\u2190'} Back</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.title}>{'\uD83D\uDE8C'} {routeName}</Text>
        <Text style={styles.subtitle}>Carrier Comparison</Text>

        {/* Winner card */}
        {winner && (
          <View style={styles.winnerCard}>
            <View style={styles.winnerTop}>
              <View style={styles.winnerBadge}>
                <Text style={styles.winnerBadgeText}>#1</Text>
              </View>
              <View style={styles.winnerInfo}>
                <Text style={styles.winnerName}>{winner.carrier}</Text>
                <Text style={[styles.winnerActivity, { color: ACTIVITY_COLORS[winner.activityLevel] }]}>
                  {'\uD83D\uDCF6'} {winner.activityLevel === 'gaming' ? 'Gaming + Streaming + Browse' :
                    winner.activityLevel === 'streaming' ? 'Streaming + Browse' :
                    winner.activityLevel === 'browsing' ? 'Browse + Messaging' :
                    winner.activityLevel === 'messaging' ? 'Messaging Only' : 'Dead Zone'}
                </Text>
              </View>
              <View style={styles.winnerDbm}>
                <Text style={[styles.winnerDbmText, { color: ACTIVITY_COLORS[winner.activityLevel] }]}>{winner.avgDbm}</Text>
                <Text style={styles.winnerDbmLabel}>avg dBm</Text>
              </View>
            </View>
          </View>
        )}

        {/* Runner-ups */}
        <View style={styles.runnersRow}>
          {runners.map((r, i) => (
            <View key={r.carrier} style={styles.runnerCard}>
              <View style={styles.runnerHeader}>
                <Text style={[styles.runnerRank, { color: ACTIVITY_COLORS[r.activityLevel] }]}>#{i + 2}</Text>
                <Text style={styles.runnerName}>{r.carrier}</Text>
              </View>
              <Text style={[styles.runnerDbm, { color: ACTIVITY_COLORS[r.activityLevel] }]}>{r.avgDbm}</Text>
              <Text style={[styles.runnerActivity, { color: ACTIVITY_COLORS[r.activityLevel] }]}>
                {'\uD83D\uDCF6'} {ACTIVITY_SHORT[r.activityLevel]}
              </Text>
            </View>
          ))}
        </View>

        {/* Segments */}
        <View style={styles.segmentSection}>
          <View style={styles.segmentHeader} onTouchEnd={() => setShowSegments(!showSegments)}>
            <Text style={styles.segmentTitle}>{'\uD83D\uDCCD'} Segment Breakdown</Text>
            <Text style={styles.segmentToggle}>{showSegments ? '\u25B2' : '\u25BC'}</Text>
          </View>

          {showSegments && (
            <View>
              {/* Column headers */}
              <View style={styles.segRow}>
                <View style={styles.segLabelCol}><Text style={styles.segHeaderText}>SEGMENT</Text></View>
                {allCarriers.map(c => (
                  <View key={c} style={styles.segCarrierCol}>
                    <Text style={[styles.segHeaderText, { color: getCarrierColor(c) }]}>{c.slice(0, 5).toUpperCase()}</Text>
                  </View>
                ))}
              </View>

              {/* Segment rows */}
              {segments.map((seg, i) => {
                const allDead = seg.carriers.every(c => c.activityLevel === 'dead');
                return (
                  <View key={i} style={[styles.segRow, styles.segDataRow, allDead && styles.segRowDead]}>
                    <View style={styles.segLabelCol}>
                      <Text style={styles.segLabel}>{allDead ? '\u26A0\uFE0F ' : ''}{seg.label}</Text>
                    </View>
                    {allCarriers.map(carrier => {
                      const found = seg.carriers.find(c => c.carrier === carrier);
                      const level = found ? found.activityLevel : 'dead';
                      return (
                        <View key={carrier} style={styles.segCarrierCol}>
                          <Text style={[styles.segBadge, { color: ACTIVITY_COLORS[level], backgroundColor: `${ACTIVITY_COLORS[level]}15` }]}>
                            {ACTIVITY_SHORT[level]}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <Text style={styles.dataNote}>Based on {totalDataPoints} crowdsourced data points</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  backBtn: { padding: 16, paddingTop: 48 },
  backText: { color: '#22C55E', fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#9CA3AF', fontSize: 13 },
  content: { flex: 1, paddingHorizontal: 16 },
  title: { color: '#F9FAFB', fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 2, marginBottom: 16 },
  winnerCard: { backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', borderRadius: 14, padding: 16, marginBottom: 12 },
  winnerTop: { flexDirection: 'row', alignItems: 'center' },
  winnerBadge: { backgroundColor: '#22C55E', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  winnerBadgeText: { color: '#111827', fontSize: 14, fontWeight: 'bold' },
  winnerInfo: { flex: 1, marginLeft: 10 },
  winnerName: { color: '#F9FAFB', fontSize: 16, fontWeight: 'bold' },
  winnerActivity: { fontSize: 12, marginTop: 2 },
  winnerDbm: { alignItems: 'flex-end' },
  winnerDbmText: { fontSize: 24, fontWeight: 'bold' },
  winnerDbmLabel: { color: '#9CA3AF', fontSize: 10 },
  runnersRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  runnerCard: { flex: 1, backgroundColor: '#1F2937', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#374151' },
  runnerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  runnerRank: { fontSize: 12, fontWeight: 'bold' },
  runnerName: { color: '#F9FAFB', fontSize: 13, fontWeight: '600' },
  runnerDbm: { fontSize: 16, fontWeight: 'bold' },
  runnerActivity: { fontSize: 10, marginTop: 2 },
  segmentSection: { backgroundColor: '#1F2937', borderRadius: 10, borderWidth: 1, borderColor: '#374151', overflow: 'hidden', marginBottom: 12 },
  segmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
  segmentTitle: { color: '#F9FAFB', fontSize: 13, fontWeight: '600' },
  segmentToggle: { color: '#9CA3AF', fontSize: 12 },
  segRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  segDataRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' },
  segRowDead: { backgroundColor: 'rgba(239,68,68,0.03)' },
  segLabelCol: { width: 70 },
  segCarrierCol: { flex: 1, alignItems: 'center' },
  segHeaderText: { color: '#9CA3AF', fontSize: 9, fontWeight: '600' },
  segLabel: { color: '#F9FAFB', fontSize: 11 },
  segBadge: { fontSize: 10, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  dataNote: { color: '#9CA3AF', fontSize: 10, textAlign: 'center', marginBottom: 20 },
});
