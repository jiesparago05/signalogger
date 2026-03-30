import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { CommuteRoute } from '../../../types/signal';
import { getActivityLevel } from '../../../lib/utils/activity-levels';

interface RouteDetailProps {
  route: CommuteRoute;
  onBack: () => void;
}

export function RouteDetail({ route, onBack }: RouteDetailProps) {
  const gradeColor = route.overallGrade === 'A' ? '#22C55E' : route.overallGrade === 'B' ? '#84CC16' : route.overallGrade === 'C' ? '#EAB308' : route.overallGrade === 'D' ? '#F97316' : '#EF4444';

  return (
    <View style={styles.container}>
      <View style={styles.backBtn} onTouchEnd={onBack}>
        <Text style={styles.backText}>{'\u2190'} Back</Text>
      </View>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{route.name}</Text>
            <Text style={styles.subtitle}>{route.totalTrips} trip{route.totalTrips !== 1 ? 's' : ''} recorded</Text>
          </View>
          <Text style={[styles.grade, { color: gradeColor }]}>{route.overallGrade}</Text>
        </View>

        {route.segments.map((seg, i) => {
          const activity = getActivityLevel(seg.avgDbm);
          const isDead = activity.level === 'dead';
          return (
            <View key={i} style={[styles.segment, isDead && styles.segmentDead]}>
              <View style={styles.segLeft}>
                <Text style={styles.segLabel}>{isDead ? '\u26A0\uFE0F ' : ''}{seg.label}</Text>
                <Text style={styles.segDistance}>~{(seg.distanceMeters / 1000).toFixed(1)} km</Text>
              </View>
              <View style={styles.segRight}>
                <Text style={[styles.activityBadge, { color: activity.color, backgroundColor: `${activity.color}15` }]}>
                  {'\uD83D\uDCF6'} {activity.label.split('+')[0].trim()}
                </Text>
                <Text style={[styles.segDbm, { color: activity.color }]}>{seg.avgDbm}</Text>
              </View>
            </View>
          );
        })}

        {route.segments.length === 0 && (
          <Text style={styles.muted}>No segment data yet. Add more trips to this route.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  backBtn: { padding: 16, paddingTop: 48 },
  backText: { color: '#22C55E', fontSize: 16, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { color: '#F9FAFB', fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  grade: { fontSize: 32, fontWeight: 'bold' },
  segment: { backgroundColor: '#1F2937', borderRadius: 8, padding: 12, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  segmentDead: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  segLeft: {},
  segLabel: { color: '#F9FAFB', fontSize: 13 },
  segDistance: { color: '#9CA3AF', fontSize: 11 },
  segRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityBadge: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  segDbm: { fontSize: 13, fontWeight: '600' },
  muted: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', marginTop: 20 },
});
