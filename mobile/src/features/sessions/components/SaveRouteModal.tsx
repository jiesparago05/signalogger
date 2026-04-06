import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Modal, StyleSheet } from 'react-native';
import { useRoutes } from '../../routes/hooks/use-routes';
import { MappingSession, CommuteRoute } from '../../../types/signal';

interface SaveRouteModalProps {
  visible: boolean;
  session: MappingSession;
  onSaved: (routeId: string) => void;
  onSkip: () => void;
}

export function SaveRouteModal({ visible, session, onSaved, onSkip }: SaveRouteModalProps) {
  const { routes, fetchRoutes, createRoute, addSessionToRoute } = useRoutes();
  const [mode, setMode] = useState<'choose' | 'existing'>('choose');
  const [routeName, setRouteName] = useState('');

  useEffect(() => {
    if (visible) {
      fetchRoutes();
      setMode('choose');
      setRouteName('');
      // Auto-suggest name from location names
      const start = session.startLocationName?.split(',')[0] || '';
      const end = session.endLocationName?.split(',')[0] || '';
      if (start && end && start !== end) {
        setRouteName(`${start} → ${end}`);
      }
    }
  }, [visible, session, fetchRoutes]);

  const handleSaveNew = async () => {
    if (!routeName.trim() || !session._id) return;
    const route = await createRoute(routeName.trim(), session._id);
    onSaved(route?._id || `local_${Date.now()}`);
  };

  const handleAddToExisting = (route: CommuteRoute) => {
    if (!session._id || !route._id) return;
    addSessionToRoute(route._id, session._id);
    onSaved(route._id);
  };

  if (!visible) return null;

  const distKm = (session.distanceMeters / 1000).toFixed(1);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {mode === 'choose' ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{'\u2705'} Session Complete</Text>
              </View>
              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{session.logCount}</Text>
                  <Text style={styles.statLabel}>logs</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{distKm}</Text>
                  <Text style={styles.statLabel}>km</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{session.avgDbm}</Text>
                  <Text style={styles.statLabel}>avg dBm</Text>
                </View>
              </View>
              {/* Route name input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Save as route</Text>
                <TextInput
                  style={styles.input}
                  value={routeName}
                  onChangeText={setRouteName}
                  placeholder="e.g. Bacoor → Makati"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              {/* Actions */}
              <View style={styles.actions}>
                <View
                  style={[styles.btn, styles.btnPrimary]}
                  onTouchEnd={handleSaveNew}
                >
                  <Text style={styles.btnPrimaryText}>Save as New Route</Text>
                </View>
                {routes.length > 0 && (
                  <View
                    style={[styles.btn, styles.btnSecondary]}
                    onTouchEnd={() => setMode('existing')}
                  >
                    <Text style={styles.btnSecondaryText}>Add to Existing Route</Text>
                  </View>
                )}
                <View onTouchEnd={onSkip} style={styles.skipBtn}>
                  <Text style={styles.skipText}>Skip</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Add to Existing Route</Text>
              </View>
              <ScrollView style={styles.routeList}>
                {routes.map((route) => (
                  <View
                    key={route._id}
                    style={styles.routeCard}
                    onTouchEnd={() => handleAddToExisting(route)}
                  >
                    <View style={styles.routeCardLeft}>
                      <Text style={styles.routeCardName}>{route.name}</Text>
                      <Text style={styles.routeCardInfo}>
                        {route.totalTrips} trip{route.totalTrips !== 1 ? 's' : ''} {'\u00B7'} {route.segments.length} segments
                      </Text>
                    </View>
                    <Text style={[styles.routeCardGrade, {
                      color: route.overallGrade === 'A' ? '#22C55E' : route.overallGrade === 'B' ? '#84CC16' : route.overallGrade === 'C' ? '#EAB308' : route.overallGrade === 'D' ? '#F97316' : '#EF4444',
                    }]}>{route.overallGrade}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.actions}>
                <View onTouchEnd={() => setMode('choose')} style={styles.skipBtn}>
                  <Text style={styles.skipText}>Cancel</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
  modal: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#374151', overflow: 'hidden' },
  header: { padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', alignItems: 'center' },
  title: { color: '#F9FAFB', fontSize: 16, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16 },
  stat: { alignItems: 'center' },
  statValue: { color: '#F9FAFB', fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: '#9CA3AF', fontSize: 10, marginTop: 2 },
  inputSection: { paddingHorizontal: 20, paddingBottom: 12 },
  inputLabel: { color: '#9CA3AF', fontSize: 11, marginBottom: 6 },
  input: { backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151', borderRadius: 8, padding: 10, color: '#F9FAFB', fontSize: 14 },
  actions: { padding: 20, paddingTop: 8, gap: 8 },
  btn: { padding: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#22C55E' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  btnSecondary: { backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151' },
  btnSecondaryText: { color: '#F9FAFB', fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  skipBtn: { padding: 8, alignItems: 'center' },
  skipText: { color: '#9CA3AF', fontSize: 13 },
  routeList: { maxHeight: 250, paddingHorizontal: 20, paddingVertical: 12 },
  routeCard: { backgroundColor: '#1F2937', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#374151', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeCardLeft: { flex: 1 },
  routeCardName: { color: '#F9FAFB', fontSize: 14, fontWeight: '600' },
  routeCardInfo: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  routeCardGrade: { fontSize: 22, fontWeight: 'bold' },
});
