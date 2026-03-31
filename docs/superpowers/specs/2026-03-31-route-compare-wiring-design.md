# Route Comparison Wiring + Session-to-Route Flow

## Overview

Wire the existing RouteComparison screen into the app's navigation, and add the session-to-route saving flow so users can create routes from mapping sessions and compare carriers along them.

**Target users:** Filipino commuters who map their daily commute and want to know which carrier is best along their route.

---

## Features

### 1. Session Complete Prompt

After user taps "Stop Mapping", replace the basic Alert with a modal dialog showing:

**Stats section:**
- Log count, distance (km), average dBm

**Actions:**
- "Save as New Route" — opens name input, creates a new route from this session
- "Add to Existing Route" — shows list of existing routes, adds this session to the selected one
- "Skip" — dismisses without saving (session still exists in Sessions tab)

**Route name input:** Text field with placeholder. User types a name like "Bacoor → Makati".

**Add to Existing picker:** Shows existing routes with name, trip count, grade. Tap one to add the session.

### 2. Session Detail Redesign

Currently: tapping a session opens a separate SessionDetail screen with its own map. This is redundant.

**New behavior:**
- Tapping a session in the Sessions tab draws the GPS path on the **main Leaflet map**
- Map auto-zooms (fitBounds) to show the entire path
- Path is color-coded by signal strength per segment (green/yellow/orange/red)
- Green dot for start point, red dot for end point
- Bottom sheet shows session stats (avg dBm, distance, duration, log count, carrier, stability)
- "Save as Route" button at bottom (if session not already saved to a route)
- "View Route" button (if session is already linked to a route)
- "Back to Sessions" link to return to the list

**Technical:** Inject polyline into Leaflet WebView via `injectJavaScript`. Clear the polyline on "Back".

### 3. Session Card Improvements

**Start/End location names on session cards:**
- When a session completes, reverse geocode the first and last GPS coordinates via Nominatim
- Store as `startLocationName` and `endLocationName` on the MappingSession model
- Display as the card title: "Bacoor → Makati City"
- If start ≈ end (< 500m apart), show as "Quezon City (stationary)"
- Date/time moves to subtitle line

**Route saved indicator:**
- If session is linked to a route: show "✅ Route name" on the card
- If not: show "📍 Not saved to a route"

### 4. Route Detail — Compare Carriers Button

**Sticky green button at bottom of RouteDetail screen:**
- Text: "📊 Compare Carriers Along This Route"
- Style: green (#22C55E) background, white bold text, 12px border-radius, shadow
- Fixed at bottom with gradient fade from transparent to background
- Tapping it navigates to the existing RouteComparison screen

**Props passed:** `routeId` and `routeName` from the current route.

### 5. Wire RouteDetail → RouteComparison

RouteDetail currently has no way to open RouteComparison. Add:
- `onCompare` callback prop to RouteDetail
- MapScreen handles the callback by setting `routeCompareId` and `routeCompareName` state
- This triggers the existing RouteComparison overlay

---

## API Changes

### Modified: MappingSession Model

Add two new fields:

```
startLocationName: String    // e.g. "Bacoor, Cavite"
endLocationName: String      // e.g. "Makati City"
```

### Modified: Session Complete Flow (server-side)

When a session is completed (`PATCH /sessions/:id/complete`), if the session has startLocation and endLocation coordinates:
- Reverse geocode both coordinates via Nominatim
- Store the area names on the session

### No New Endpoints

All existing endpoints are sufficient:
- `POST /routes` — create route from session
- `PATCH /routes/:id/add-session` — add session to existing route
- `GET /compare/route/:routeId` — get carrier comparison (already exists)

---

## Mobile App Changes

### New Files

| File | Purpose |
|------|---------|
| `src/features/sessions/components/SaveRouteModal.tsx` | Modal dialog for saving session as route (shared by session complete + session detail) |

### Modified Files

| File | Change |
|------|--------|
| `src/features/map-view/components/MapScreen.tsx` | Handle session complete prompt, draw session path on map, wire RouteDetail onCompare |
| `src/features/sessions/components/SessionsList.tsx` | Show start→end names on cards, route saved indicator |
| `src/features/sessions/components/SessionDetail.tsx` | Redesign: no separate map, show stats + Save as Route in bottom sheet |
| `src/features/routes/components/RouteDetail.tsx` | Add sticky "Compare Carriers" button, add onCompare prop |
| `src/features/sessions/hooks/use-session.ts` | Return location names after session complete |

### Backend Modified Files

| File | Change |
|------|--------|
| `server/models/mapping-session.js` | Add startLocationName, endLocationName fields |
| `server/services/session-service.js` | Reverse geocode on session complete |

---

## Data Flow

```
Session Complete:
  User taps Stop Mapping
    → Session saved to DB
    → Reverse geocode start/end coords → store location names
    → SaveRouteModal appears with stats
    → User picks: Save New / Add Existing / Skip
    → If save: POST /routes or PATCH /routes/:id/add-session

Session Detail (tap from Sessions tab):
  Tap session card
    → Inject polyline into Leaflet map (color-coded by signal)
    → Map fitBounds to path
    → Bottom sheet shows session stats + Save as Route button
    → Back clears the polyline

Route Detail → Compare:
  RouteDetail shows sticky "Compare Carriers" button
    → Tap → onCompare(routeId, routeName)
    → MapScreen sets routeCompareId state
    → RouteComparison overlay renders
    → GET /compare/route/:routeId
    → Shows carrier ranking + segment breakdown
```

---

## What's NOT in Scope

- Manual start/destination route input (future phase)
- Route editing, renaming, or deletion
- Work Spots UI (parked)
- Strava-style mini map thumbnails on session cards (future — nice-to-have)
- Path preview stored on session model (can add later for performance)

---

## Testing Strategy

| What | How |
|------|-----|
| Session complete prompt | Manual: start mapping, stop, verify modal appears with stats and save options |
| Save as new route | Manual: enter name, save, verify route appears in Routes tab |
| Add to existing route | Manual: save session to existing route, verify trip count increments |
| Session card location names | Manual: complete a session, verify start→end names appear on card |
| Session path on map | Manual: tap session in Sessions tab, verify polyline drawn on main map |
| Compare Carriers button | Manual: open route detail, tap Compare, verify RouteComparison opens |
| Reverse geocoding | Integration test: complete session with coords, verify location names stored |
