import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { WorkZone } from '../../../types/signal';
import { getActivityLevel } from '../../../lib/utils/activity-levels';
import { getCarrierColor } from '../../../lib/config';

interface WorkSpotsListProps {
  spots: WorkZone[];
  loading: boolean;
}

export function WorkSpotsList({ spots, loading }: WorkSpotsListProps) {
  if (loading) {
    return <View style={styles.center}><Text style={styles.muted}>Searching nearby work spots...</Text></View>;
  }
  if (spots.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No work spots found nearby.</Text>
        <Text style={styles.hint}>More mapping data needed in this area.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {spots.map((spot, i) => {
        const activity = getActivityLevel(spot.bestAvgDbm);
        return (
          <View key={i} style={styles.card}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.spotTitle}>Zone {i + 1}</Text>
                <Text style={styles.spotInfo}>Best: {spot.bestCarrier} {'\u00B7'} {spot.bestAvgDbm} dBm</Text>
              </View>
              <View style={[styles.activityBadge, { backgroundColor: `${activity.color}15` }]}>
                <Text style={[styles.activityText, { color: activity.color }]}>{'\uD83D\uDCF6'} {activity.label.split('+')[0].trim()}</Text>
              </View>
            </View>
            <View style={styles.carriers}>
              {(spot.carriers || []).map((c, j) => (
                <View key={j} style={styles.carrierRow}>
                  <View style={[styles.dot, { backgroundColor: getCarrierColor(c.carrier) }]} />
                  <Text style={styles.carrierName}>{c.carrier}</Text>
                  <Text style={[styles.carrierDbm, { color: getActivityLevel(c.avgDbm).color }]}>{c.avgDbm} dBm</Text>
                  <Text style={styles.carrierCount}>{c.sampleCount} logs</Text>
                </View>
              ))}
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
  hint: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },
  card: { backgroundColor: '#1F2937', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#374151' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spotTitle: { color: '#F9FAFB', fontSize: 14, fontWeight: '600' },
  spotInfo: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  activityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  activityText: { fontSize: 11, fontWeight: '500' },
  carriers: { marginTop: 10, gap: 6 },
  carrierRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  carrierName: { color: '#F9FAFB', fontSize: 13, width: 60 },
  carrierDbm: { fontSize: 12, fontWeight: '600', width: 70 },
  carrierCount: { color: '#9CA3AF', fontSize: 11 },
});
