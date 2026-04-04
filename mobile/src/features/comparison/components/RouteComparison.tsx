import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useComparison } from '../hooks/use-comparison';
import { ACTIVITY_COLORS, ACTIVITY_SHORT } from '../../../lib/utils/activity-levels';

interface RouteComparisonProps {
  routeId: string;
  routeName: string;
  onBack: () => void;
}

const ACTIVITY_LABELS: Record<string, string> = {
  gaming: 'Gaming + Streaming',
  streaming: 'Streaming + Browse',
  browsing: 'Browse + Messaging',
  messaging: 'Messaging Only',
  dead: 'Dead Zone',
};

export function RouteComparison({ routeId, routeName, onBack }: RouteComparisonProps) {
  const { routeData, loading, compareRoute } = useComparison();
  const [showSegments, setShowSegments] = useState(false);

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
        {/* Section label */}
        <Text style={styles.sectionLabel}>Route Comparison</Text>

        {/* Route name */}
        <Text style={styles.title}>{routeName}</Text>
        <Text style={styles.subtitle}>{ranking.length} carriers {'\u00B7'} {totalDataPoints} data points</Text>

        {/* Winner hero card */}
        {winner && (
          <View style={styles.winnerCard}>
            <View style={styles.winnerLeft}>
              <Text style={styles.winnerTrophy}>{'\uD83C\uDFC6'}</Text>
              <Text style={styles.winnerRank}>#1</Text>
            </View>
            <View style={styles.winnerCenter}>
              <Text style={styles.winnerName}>{winner.carrier}</Text>
              <Text style={[styles.winnerActivity, { color: ACTIVITY_COLORS[winner.activityLevel] }]}>
                {ACTIVITY_LABELS[winner.activityLevel] || winner.activityLevel}
              </Text>
              <View style={styles.winnerBarWrap}>
                <View style={[styles.winnerBar, {
                  width: `${Math.max(5, Math.min(100, ((winner.avgDbm + 130) / 130) * 100))}%`,
                  backgroundColor: ACTIVITY_COLORS[winner.activityLevel],
                }]} />
              </View>
            </View>
            <View style={styles.winnerRight}>
              <Text style={[styles.winnerDbm, { color: ACTIVITY_COLORS[winner.activityLevel] }]}>{winner.avgDbm}</Text>
              <Text style={styles.winnerDbmLabel}>avg dBm</Text>
            </View>
          </View>
        )}

        {/* Other carriers */}
        {runners.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Other Carriers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.runnersScroll}>
              {runners.map((r, i) => {
                const color = ACTIVITY_COLORS[r.activityLevel] || '#EF4444';
                return (
                  <View key={r.carrier} style={styles.runnerCard}>
                    <Text style={[styles.runnerRank, { color }]}>#{i + 2}</Text>
                    <Text style={styles.runnerName}>{r.carrier}</Text>
                    <Text style={[styles.runnerDbm, { color }]}>{r.avgDbm}</Text>
                    <View style={[styles.runnerBadge, { backgroundColor: `${color}15` }]}>
                      <Text style={[styles.runnerBadgeText, { color }]}>
                        {ACTIVITY_LABELS[r.activityLevel] || r.activityLevel}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Segment breakdown — collapsed by default */}
        {segments.length > 0 && (
          <View style={styles.segmentSection}>
            <View style={styles.segmentHeader} onTouchEnd={() => setShowSegments(!showSegments)}>
              <Text style={styles.segmentTitle}>{'\uD83D\uDCCD'} Segment Breakdown</Text>
              <Text style={styles.segmentToggle}>{showSegments ? '\u25B2' : '\u25BC'}</Text>
            </View>

            {showSegments && (
              <View>
                <View style={styles.segRow}>
                  <View style={styles.segLabelCol}><Text style={styles.segHeaderText}>SEGMENT</Text></View>
                  {allCarriers.map(c => (
                    <View key={c} style={styles.segCarrierCol}>
                      <Text style={styles.segHeaderText}>{c.slice(0, 5).toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
                {segments.map((seg: any, i: number) => {
                  const allDead = seg.carriers.every((c: any) => c.activityLevel === 'dead');
                  return (
                    <View key={i} style={[styles.segRow, styles.segDataRow, allDead && styles.segRowDead]}>
                      <View style={styles.segLabelCol}>
                        <Text style={styles.segLabel}>{allDead ? '\u26A0\uFE0F ' : ''}{seg.label}</Text>
                      </View>
                      {allCarriers.map(carrier => {
                        const found = seg.carriers.find((c: any) => c.carrier === carrier);
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
        )}

        <Text style={styles.dataNote}>Based on {totalDataPoints} crowdsourced data points</Text>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(17,24,39,0.95)' },
  backBtn: { padding: 16, paddingTop: 12, paddingBottom: 8 },
  backText: { color: '#22C55E', fontSize: 13, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#9CA3AF', fontSize: 13 },
  content: { flex: 1, paddingHorizontal: 16 },
  sectionLabel: { color: '#6B7280', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  title: { color: '#F9FAFB', fontSize: 15, fontWeight: 'bold' },
  subtitle: { color: '#9CA3AF', fontSize: 11, marginTop: 2, marginBottom: 12 },
  // Winner
  winnerCard: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  winnerLeft: { marginRight: 12, alignItems: 'center' },
  winnerTrophy: { fontSize: 22 },
  winnerRank: { color: '#22C55E', fontSize: 9, fontWeight: 'bold', marginTop: 2 },
  winnerCenter: { flex: 1 },
  winnerName: { color: '#F9FAFB', fontSize: 16, fontWeight: 'bold' },
  winnerActivity: { fontSize: 11, marginTop: 2 },
  winnerBarWrap: { height: 4, borderRadius: 2, backgroundColor: '#293548', overflow: 'hidden', marginTop: 6, width: '80%' },
  winnerBar: { height: 4, borderRadius: 2 },
  winnerRight: { alignItems: 'flex-end' },
  winnerDbm: { fontSize: 26, fontWeight: 'bold' },
  winnerDbmLabel: { color: '#9CA3AF', fontSize: 9 },
  // Runners
  runnersScroll: { marginBottom: 12 },
  runnerCard: {
    minWidth: 120,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    marginRight: 8,
  },
  runnerRank: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  runnerName: { color: '#F9FAFB', fontSize: 14, fontWeight: 'bold' },
  runnerDbm: { fontSize: 22, fontWeight: 'bold', marginVertical: 4 },
  runnerBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  runnerBadgeText: { fontSize: 9 },
  // Segments
  segmentSection: { backgroundColor: '#1F2937', borderRadius: 10, borderWidth: 1, borderColor: '#374151', overflow: 'hidden', marginTop: 12 },
  segmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
  segmentTitle: { color: '#F9FAFB', fontSize: 12, fontWeight: '600' },
  segmentToggle: { color: '#9CA3AF', fontSize: 10 },
  segRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  segDataRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.03)' },
  segRowDead: { backgroundColor: 'rgba(239,68,68,0.03)' },
  segLabelCol: { width: 70 },
  segCarrierCol: { flex: 1, alignItems: 'center' },
  segHeaderText: { color: '#9CA3AF', fontSize: 9, fontWeight: '600' },
  segLabel: { color: '#F9FAFB', fontSize: 11 },
  segBadge: { fontSize: 10, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  dataNote: { color: '#6B7280', fontSize: 9, textAlign: 'center', marginTop: 12 },
});
