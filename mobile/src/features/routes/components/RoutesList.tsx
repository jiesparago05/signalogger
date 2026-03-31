import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRoutes } from '../hooks/use-routes';
import { CommuteRoute } from '../../../types/signal';

interface RoutesListProps {
  onSelectRoute: (route: CommuteRoute) => void;
}

export function RoutesList({ onSelectRoute }: RoutesListProps) {
  const { routes, loading, fetchRoutes } = useRoutes();

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  if (loading) {
    return <View style={styles.center}><Text style={styles.muted}>Loading routes...</Text></View>;
  }
  if (routes.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No saved routes yet.</Text>
        <Text style={styles.hint}>Complete a mapping session and save it as a route.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {routes.map((route) => {
        const gradeColor = route.overallGrade === 'A' ? '#22C55E' : route.overallGrade === 'B' ? '#84CC16' : route.overallGrade === 'C' ? '#EAB308' : route.overallGrade === 'D' ? '#F97316' : '#EF4444';
        return (
          <View key={route._id} style={styles.card} onTouchEnd={() => onSelectRoute(route)}>
            <View style={styles.cardTop}>
              <View style={styles.cardLeft}>
                <Text style={styles.routeName}>{route.name}</Text>
                <Text style={styles.routeInfo}>{route.totalTrips} trip{route.totalTrips !== 1 ? 's' : ''} {'\u00B7'} {route.segments.length} segments</Text>
              </View>
              <Text style={[styles.grade, { color: gradeColor }]}>{route.overallGrade}</Text>
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
  cardLeft: { flex: 1 },
  routeName: { color: '#F9FAFB', fontSize: 15, fontWeight: '600' },
  routeInfo: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  grade: { fontSize: 24, fontWeight: 'bold' },
});
