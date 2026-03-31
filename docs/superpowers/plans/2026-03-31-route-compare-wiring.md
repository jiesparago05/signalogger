# Route Comparison Wiring + Session-to-Route Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing RouteComparison screen into the app so users can save mapping sessions as routes and compare carriers along them.

**Architecture:** Backend adds location name fields to sessions + reverse geocoding on complete. Mobile adds SaveRouteModal (shared between session complete + session detail), redesigns SessionDetail to draw trail on main map, and adds sticky Compare button to RouteDetail. All changes sync between `mobile/src/` and `src/` directories.

**Tech Stack:** React Native, Node.js/Express, MongoDB/Mongoose, Leaflet (WebView), Nominatim reverse geocoding

**Important:** After modifying any file in `mobile/src/`, copy it to the matching path in `src/` (the two directories must stay in sync). After backend changes, restart the server (`node index.js`). After mobile JS changes, press `r` in Metro to reload.

---

### Task 1: Add Location Name Fields to Backend

**Files:**
- Modify: `server/models/mapping-session.js:3-26`
- Modify: `server/services/session-service.js:8-14`

- [ ] **Step 1: Add fields to MappingSession schema**

In `server/models/mapping-session.js`, add two fields after `endLocation` (after line 14):

```javascript
  startLocationName: String,
  endLocationName: String,
```

- [ ] **Step 2: Add reverse geocoding helper to session-service.js**

At the top of `server/services/session-service.js`, after line 2, add:

```javascript
async function reverseGeocode(lng, lat) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14`,
      { headers: { 'User-Agent': 'Signalog/1.0' } },
    );
    const data = await res.json();
    const parts = (data.display_name || '').split(',');
    // Return neighborhood/suburb + city, or just the first 2 parts
    return parts.slice(0, 2).map(s => s.trim()).join(', ');
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Call reverse geocoding in the complete function**

Replace the `complete` function (lines 8-14) with:

```javascript
async function complete(sessionId, stats) {
  const session = await MappingSession.findByIdAndUpdate(
    sessionId,
    { ...stats, status: 'completed' },
    { new: true },
  );

  // Reverse geocode start/end in background (don't block response)
  if (session) {
    (async () => {
      const updates = {};
      if (session.startLocation?.coordinates) {
        const [lng, lat] = session.startLocation.coordinates;
        const name = await reverseGeocode(lng, lat);
        if (name) updates.startLocationName = name;
      }
      if (session.endLocation?.coordinates) {
        const [lng, lat] = session.endLocation.coordinates;
        const name = await reverseGeocode(lng, lat);
        if (name) updates.endLocationName = name;
      }
      if (Object.keys(updates).length > 0) {
        await MappingSession.findByIdAndUpdate(sessionId, updates);
      }
    })().catch(err => console.warn('Geocode failed:', err));
  }

  return session;
}
```

- [ ] **Step 4: Export the updated module**

No change needed — `complete` is already exported.

- [ ] **Step 5: Restart backend and test**

Restart server: `cd server && node index.js`

Test with curl:
```bash
curl -s http://localhost:3000/api/sessions/device/cf5ae528-8e6a-47f2-98fd-dbb38638bbfa?limit=1
```

Verify the session still loads. The new fields will be `undefined` on old sessions — that's expected.

- [ ] **Step 6: Commit**

```bash
git add server/models/mapping-session.js server/services/session-service.js
git commit -m "feat(backend): add location name fields + reverse geocoding on session complete"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `mobile/src/types/signal.ts:90-108`

- [ ] **Step 1: Add location name fields to MappingSession interface**

In `mobile/src/types/signal.ts`, add two fields to the `MappingSession` interface, after the `endLocation` field (after line 97):

```typescript
  startLocationName?: string;
  endLocationName?: string;
```

- [ ] **Step 2: Sync to src/**

```bash
cp mobile/src/types/signal.ts src/types/signal.ts
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/types/signal.ts src/types/signal.ts
git commit -m "feat(types): add startLocationName, endLocationName to MappingSession"
```

---

### Task 3: Create SaveRouteModal Component

**Files:**
- Create: `mobile/src/features/sessions/components/SaveRouteModal.tsx`

- [ ] **Step 1: Create the SaveRouteModal**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Modal, StyleSheet } from 'react-native';
import { useRoutes } from '../../routes/hooks/use-routes';
import { MappingSession, CommuteRoute } from '../../../types/signal';

interface SaveRouteModalProps {
  visible: boolean;
  session: MappingSession;
  onSaved: () => void;
  onSkip: () => void;
}

export function SaveRouteModal({ visible, session, onSaved, onSkip }: SaveRouteModalProps) {
  const { routes, fetchRoutes, createRoute, addSessionToRoute } = useRoutes();
  const [mode, setMode] = useState<'choose' | 'existing'>('choose');
  const [routeName, setRouteName] = useState('');
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      await createRoute(routeName.trim(), session._id);
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
  };

  const handleAddToExisting = async (route: CommuteRoute) => {
    if (!session._id || !route._id) return;
    setSaving(true);
    try {
      await addSessionToRoute(route._id, session._id);
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
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
                  style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
                  onTouchEnd={saving ? undefined : handleSaveNew}
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
```

- [ ] **Step 2: Sync to src/**

```bash
cp mobile/src/features/sessions/components/SaveRouteModal.tsx src/features/sessions/components/SaveRouteModal.tsx
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/features/sessions/components/SaveRouteModal.tsx src/features/sessions/components/SaveRouteModal.tsx
git commit -m "feat(mobile): add SaveRouteModal component for saving sessions as routes"
```

---

### Task 4: Wire SaveRouteModal into MapScreen (Session Complete)

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Add import for SaveRouteModal**

Add after the existing imports (around line 25):

```typescript
import { SaveRouteModal } from '../../sessions/components/SaveRouteModal';
```

- [ ] **Step 2: Add state for completed session**

After the `sheetHeight` state declaration, add:

```typescript
const [completedSession, setCompletedSession] = useState<MappingSession | null>(null);
```

Add the MappingSession import if not already present — update the existing import from `'../../../types/signal'` to include `MappingSession`.

- [ ] **Step 3: Replace Alert with SaveRouteModal in handleToggle**

In `handleToggle`, replace:

```typescript
      if (completed) {
        Alert.alert(
          'Session Complete',
          `${completed.logCount} logs \u00B7 ${completed.distanceMeters}m \u00B7 avg ${completed.avgDbm} dBm`,
          [{ text: 'OK' }],
        );
      }
```

With:

```typescript
      if (completed) {
        setCompletedSession(completed);
      }
```

- [ ] **Step 4: Add SaveRouteModal to JSX**

Before the closing `</View>` of the main container (before `ReportModal`), add:

```tsx
      {/* Save route modal after session complete */}
      {completedSession && (
        <SaveRouteModal
          visible={!!completedSession}
          session={completedSession}
          onSaved={() => setCompletedSession(null)}
          onSkip={() => setCompletedSession(null)}
        />
      )}
```

- [ ] **Step 5: Remove Alert import if no longer used elsewhere**

Check if `Alert` is used elsewhere in MapScreen. If not, remove it from the `react-native` import.

- [ ] **Step 6: Sync to src/ and reload**

```bash
cp mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
```

Press `r` in Metro to reload. Test: Start Mapping → Stop → SaveRouteModal should appear.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
git commit -m "feat(mobile): show SaveRouteModal on session complete instead of Alert"
```

---

### Task 5: Add Leaflet Polyline Functions to Map

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx` (the LEAFLET_HTML string)

- [ ] **Step 1: Add polyline drawing functions to LEAFLET_HTML**

In the LEAFLET_HTML template, after the `addHeatCircle` function (around line 102), add these JavaScript functions:

```javascript
    var sessionPolylines = [];
    var sessionMarkers = [];

    function drawSessionTrail(trailData) {
      clearSessionTrail();
      if (!trailData || trailData.length < 2) return;

      // Draw color-coded polyline segments
      for (var i = 1; i < trailData.length; i++) {
        var prev = trailData[i-1];
        var curr = trailData[i];
        var line = L.polyline(
          [[prev.lat, prev.lng], [curr.lat, curr.lng]],
          { color: curr.color, weight: 5, opacity: 0.8 }
        ).addTo(map);
        sessionPolylines.push(line);
      }

      // Start marker (green)
      var startM = L.circleMarker(
        [trailData[0].lat, trailData[0].lng],
        { radius: 7, fillColor: '#22C55E', fillOpacity: 1, stroke: true, color: '#fff', weight: 3 }
      ).addTo(map);
      sessionMarkers.push(startM);

      // End marker (red)
      var endM = L.circleMarker(
        [trailData[trailData.length-1].lat, trailData[trailData.length-1].lng],
        { radius: 7, fillColor: '#EF4444', fillOpacity: 1, stroke: true, color: '#fff', weight: 3 }
      ).addTo(map);
      sessionMarkers.push(endM);

      // Fit map bounds to trail
      var lats = trailData.map(function(p) { return p.lat; });
      var lngs = trailData.map(function(p) { return p.lng; });
      map.fitBounds([
        [Math.min.apply(null, lats) - 0.002, Math.min.apply(null, lngs) - 0.002],
        [Math.max.apply(null, lats) + 0.002, Math.max.apply(null, lngs) + 0.002]
      ]);
    }

    function clearSessionTrail() {
      sessionPolylines.forEach(function(l) { map.removeLayer(l); });
      sessionMarkers.forEach(function(m) { map.removeLayer(m); });
      sessionPolylines = [];
      sessionMarkers = [];
    }
```

- [ ] **Step 2: Sync to src/ and commit**

```bash
cp mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
git add mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
git commit -m "feat(mobile): add drawSessionTrail/clearSessionTrail Leaflet functions"
```

---

### Task 6: Redesign SessionDetail — Path on Main Map

**Files:**
- Modify: `mobile/src/features/sessions/components/SessionDetail.tsx` (full rewrite)
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Rewrite SessionDetail as a bottom-sheet-friendly overlay**

Replace the entire content of `mobile/src/features/sessions/components/SessionDetail.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { api } from '../../../lib/api/client';
import { getSignalColor } from '../../../lib/config';
import { MappingSession } from '../../../types/signal';

interface SessionDetailProps {
  session: MappingSession;
  onBack: () => void;
  onDrawTrail: (trail: { lat: number; lng: number; color: string }[]) => void;
  onClearTrail: () => void;
  onSaveAsRoute: () => void;
}

export function SessionDetail({ session, onBack, onDrawTrail, onClearTrail, onSaveAsRoute }: SessionDetailProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session._id) return;
    (async () => {
      try {
        const res = await api.sessions.getTrail(session._id!);
        const trailPoints = (res.data || []).map((log: any) => {
          const [lng, lat] = log.location.coordinates;
          return { lat, lng, color: getSignalColor(log.signal.dbm) };
        });
        onDrawTrail(trailPoints);
      } catch (err) {
        console.warn('Failed to load trail:', err);
      } finally {
        setLoading(false);
      }
    })();

    return () => onClearTrail();
  }, [session._id]);

  const start = new Date(session.startTime);
  const end = session.endTime ? new Date(session.endTime) : null;
  const durationMin = end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
  const distKm = (session.distanceMeters / 1000).toFixed(1);
  const signalColor = getSignalColor(session.avgDbm);
  const title = session.startLocationName && session.endLocationName
    ? `${session.startLocationName.split(',')[0]} → ${session.endLocationName.split(',')[0]}`
    : `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} session`;

  return (
    <View style={styles.container}>
      <View style={styles.backBtn} onTouchEnd={onBack}>
        <Text style={styles.backText}>{'\u2190'} Back to Sessions</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><Text style={styles.muted}>Loading trail...</Text></View>
      ) : (
        <ScrollView style={styles.content}>
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

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: getSignalColor(session.maxDbm) }]}>{session.maxDbm}</Text>
              <Text style={styles.statLabel}>Best</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: getSignalColor(session.avgDbm) }]}>{session.avgDbm}</Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: getSignalColor(session.minDbm) }]}>{session.minDbm}</Text>
              <Text style={styles.statLabel}>Worst</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoText}>{session.carrier} {'\u00B7'} {session.networkType} {'\u00B7'} {session.stability}</Text>
          </View>
        </ScrollView>
      )}

      {/* Save as Route button */}
      {!session.routeId && (
        <View style={styles.bottomBtn} onTouchEnd={onSaveAsRoute}>
          <Text style={styles.bottomBtnText}>{'\uD83D\uDCCD'} Save as Route</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(17,24,39,0.95)' },
  backBtn: { padding: 16, paddingTop: 12 },
  backText: { color: '#22C55E', fontSize: 14, fontWeight: '600' },
  loadingWrap: { alignItems: 'center', paddingVertical: 30 },
  muted: { color: '#9CA3AF', fontSize: 13 },
  content: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerLeft: { flex: 1 },
  title: { color: '#F9FAFB', fontSize: 16, fontWeight: 'bold' },
  subtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerDbm: { fontSize: 24, fontWeight: 'bold' },
  headerDbmLabel: { color: '#9CA3AF', fontSize: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, backgroundColor: '#1F2937', borderRadius: 12, borderWidth: 1, borderColor: '#374151', marginBottom: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#9CA3AF', fontSize: 10, marginTop: 2 },
  infoRow: { alignItems: 'center', paddingVertical: 8 },
  infoText: { color: '#9CA3AF', fontSize: 12 },
  bottomBtn: { backgroundColor: '#22C55E', margin: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  bottomBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
```

- [ ] **Step 2: Update MapScreen to pass trail drawing callbacks to SessionDetail**

In MapScreen, update the SessionDetail overlay section. Replace:

```tsx
      {/* Session detail overlay */}
      {selectedSession && (
        <SessionDetail
          session={selectedSession}
          onBack={() => setSelectedSession(null)}
        />
      )}
```

With:

```tsx
      {/* Session detail overlay - shows in bottom area, trail drawn on main map */}
      {selectedSession && (
        <View style={styles.sessionOverlay}>
          <SessionDetail
            session={selectedSession}
            onBack={() => {
              setSelectedSession(null);
            }}
            onDrawTrail={(trail) => {
              const trailJSON = JSON.stringify(trail);
              webViewRef.current?.injectJavaScript(`drawSessionTrail(${trailJSON}); true;`);
            }}
            onClearTrail={() => {
              webViewRef.current?.injectJavaScript('clearSessionTrail(); true;');
            }}
            onSaveAsRoute={() => {
              setCompletedSession(selectedSession);
            }}
          />
        </View>
      )}
```

- [ ] **Step 3: Add sessionOverlay style**

In the `styles` StyleSheet, add:

```typescript
  sessionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
```

- [ ] **Step 4: Sync to src/ and reload**

```bash
cp mobile/src/features/sessions/components/SessionDetail.tsx src/features/sessions/components/SessionDetail.tsx
cp mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
```

Press `r` in Metro. Test: Sessions tab → tap a session → trail should appear on main map with session info in bottom overlay.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/features/sessions/components/SessionDetail.tsx src/features/sessions/components/SessionDetail.tsx mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
git commit -m "feat(mobile): redesign SessionDetail to draw trail on main map"
```

---

### Task 7: Update Session Cards with Location Names

**Files:**
- Modify: `mobile/src/features/sessions/components/SessionsList.tsx`

- [ ] **Step 1: Update session card rendering**

In `SessionsList.tsx`, update the card rendering inside `sessions.map()`. Replace the card content (the `return` block inside `.map()`, currently lines 49-69) with:

```tsx
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
```

- [ ] **Step 2: Update styles**

Replace the `cardDate` style and add new styles:

```typescript
  cardTitle: { color: '#F9FAFB', fontSize: 14, fontWeight: '600' },
  cardLeft: { flex: 1 },
  routeSaved: { color: '#22C55E', fontSize: 10, marginLeft: 'auto' },
  routeUnsaved: { color: '#9CA3AF', fontSize: 10, marginLeft: 'auto' },
```

Remove the old `cardDate` style if it exists.

- [ ] **Step 3: Sync and commit**

```bash
cp mobile/src/features/sessions/components/SessionsList.tsx src/features/sessions/components/SessionsList.tsx
git add mobile/src/features/sessions/components/SessionsList.tsx src/features/sessions/components/SessionsList.tsx
git commit -m "feat(mobile): show location names and route status on session cards"
```

---

### Task 8: Add Compare Carriers Button to RouteDetail

**Files:**
- Modify: `mobile/src/features/routes/components/RouteDetail.tsx`
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Add onCompare prop and sticky button to RouteDetail**

In `mobile/src/features/routes/components/RouteDetail.tsx`, update the interface:

```typescript
interface RouteDetailProps {
  route: CommuteRoute;
  onBack: () => void;
  onCompare: (routeId: string, routeName: string) => void;
}
```

Update the function signature:

```typescript
export function RouteDetail({ route, onBack, onCompare }: RouteDetailProps) {
```

After the `</ScrollView>` closing tag (before the final `</View>`), add the sticky button:

```tsx
      {/* Sticky Compare Carriers button */}
      <View style={styles.stickyBottom}>
        <View
          style={styles.compareBtn}
          onTouchEnd={() => route._id && onCompare(route._id, route.name)}
        >
          <Text style={styles.compareBtnText}>{'\uD83D\uDCCA'} Compare Carriers Along This Route</Text>
        </View>
      </View>
```

Add styles:

```typescript
  stickyBottom: { padding: 16, paddingBottom: 28, backgroundColor: '#111827' },
  compareBtn: { backgroundColor: '#22C55E', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  compareBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
```

- [ ] **Step 2: Wire onCompare in MapScreen**

In MapScreen, update the RouteDetail overlay:

```tsx
      {/* Route detail overlay */}
      {selectedRoute && (
        <RouteDetail
          route={selectedRoute}
          onBack={() => setSelectedRoute(null)}
          onCompare={(routeId, routeName) => {
            setSelectedRoute(null);
            setRouteCompareId(routeId);
            setRouteCompareName(routeName);
          }}
        />
      )}
```

- [ ] **Step 3: Sync and reload**

```bash
cp mobile/src/features/routes/components/RouteDetail.tsx src/features/routes/components/RouteDetail.tsx
cp mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
```

Press `r`. Test: Routes tab → tap route → RouteDetail → tap "Compare Carriers" → RouteComparison should open.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/features/routes/components/RouteDetail.tsx src/features/routes/components/RouteDetail.tsx mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
git commit -m "feat(mobile): add Compare Carriers button to RouteDetail, wire to RouteComparison"
```

---

### Task 9: Manual Test — Full Flow

- [ ] **Step 1: Restart backend**

```bash
cd server && node index.js
```

- [ ] **Step 2: Test session complete → save route flow**

1. Open app, tap "Start Mapping"
2. Walk/wait for a few logs
3. Tap "Stop Mapping"
4. Verify SaveRouteModal appears with stats
5. Enter a route name, tap "Save as New Route"
6. Switch to Routes tab — verify route appears

- [ ] **Step 3: Test session detail → trail on map**

1. Switch to Sessions tab
2. Tap a session
3. Verify trail draws on the main map (color-coded, start/end markers)
4. Verify session stats show in bottom overlay
5. Tap "Back to Sessions" — trail clears

- [ ] **Step 4: Test Compare Carriers**

1. Go to Routes tab → tap a route
2. Verify sticky "Compare Carriers" button at bottom
3. Tap it → RouteComparison screen should open
4. Verify carrier ranking and segment breakdown display

- [ ] **Step 5: Test location names on session cards**

1. Complete a new mapping session (after backend restart, so reverse geocoding runs)
2. Check Sessions tab — new session should show start → end location names
3. Old sessions without location names should still show date/time format
