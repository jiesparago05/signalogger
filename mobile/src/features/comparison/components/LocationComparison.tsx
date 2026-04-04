import React, { useEffect } from 'react';
import { View, Text, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { useComparison } from '../hooks/use-comparison';
import { getCarrierColor } from '../../../lib/config';
import { ACTIVITY_COLORS } from '../../../lib/utils/activity-levels';

interface LocationComparisonProps {
  visible: boolean;
  coordinates: [number, number] | null;
  onClose: () => void;
}

const ACTIVITY_LABELS: Record<string, string> = {
  gaming: 'Gaming + Streaming',
  streaming: 'Streaming + Browse',
  browsing: 'Browse + Messaging',
  messaging: 'Messaging Only',
  dead: 'Dead Zone',
};

export function LocationComparison({ visible, coordinates, onClose }: LocationComparisonProps) {
  const { locationData, usedRadius, loading, compareLocation } = useComparison();

  useEffect(() => {
    if (visible && coordinates) {
      compareLocation(coordinates[0], coordinates[1]);
    }
  }, [visible, coordinates, compareLocation]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.popup}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{'\uD83D\uDCCD'} Signal Here</Text>
              <Text style={styles.subtitle}>{usedRadius}m radius {'\u00B7'} Last 7 days</Text>
            </View>
            <View onTouchEnd={onClose} style={styles.closeWrap}>
              <Text style={styles.closeBtn}>{'\u2715'}</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#22C55E" />
              <Text style={styles.muted}>Comparing carriers...</Text>
            </View>
          ) : locationData.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.muted}>No data for this area yet.</Text>
              <Text style={styles.hint}>More mapping data needed here.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {locationData.map((item, i) => (
                <View key={item.carrier} style={styles.carrierRow}>
                  <View style={styles.carrierLeft}>
                    <View style={[styles.dot, { backgroundColor: getCarrierColor(item.carrier) }]} />
                    <Text style={styles.carrierName}>{item.carrier}</Text>
                  </View>
                  <View style={styles.carrierRight}>
                    <Text style={[styles.activityBadge, { color: ACTIVITY_COLORS[item.activityLevel], backgroundColor: `${ACTIVITY_COLORS[item.activityLevel]}15` }]}>
                      {ACTIVITY_LABELS[item.activityLevel]}
                    </Text>
                    <Text style={[styles.carrierDbm, { color: ACTIVITY_COLORS[item.activityLevel] }]}>{item.avgDbm}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  popup: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#374151', overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  title: { color: '#F9FAFB', fontSize: 16, fontWeight: 'bold' },
  subtitle: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  closeWrap: { padding: 4 },
  closeBtn: { color: '#9CA3AF', fontSize: 16 },
  loadingWrap: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  muted: { color: '#9CA3AF', fontSize: 13 },
  hint: { color: '#9CA3AF', fontSize: 11 },
  list: { padding: 12 },
  carrierRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 },
  carrierLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  carrierName: { color: '#F9FAFB', fontSize: 14 },
  carrierRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityBadge: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  carrierDbm: { fontSize: 14, fontWeight: '600', width: 35, textAlign: 'right' },
});
