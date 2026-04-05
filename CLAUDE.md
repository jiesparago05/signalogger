# Signalog

## Project Structure

- **Source code lives in `mobile/src/`** — always edit files here, NOT the root `src/` directory
- Root `src/` is a mirror — after editing `mobile/src/`, copy changes to `src/` to keep them in sync
- Verify the correct path before every edit: `mobile/src/features/...` not `src/features/...`
- Server code lives in `server/`
- Build output: `C:\sl\mobile\android\app\build\outputs\apk\release\app-release.apk`

## What This Is

A crowdsourced mobile app that maps real-world signal strength and dead zones for Filipino commuters and remote workers.

## Tech Stack

- React Native (Android-first, New Architecture / Fabric)
- Node.js (Express) — deployed to Render (signalogger.onrender.com)
- MongoDB Atlas (Singapore region)
- Leaflet (map via WebView)

## Features (Current)

- Background signal logging (5s interval)
- Map visualization (signal dots + heatmap)
- Manual reporting
- Offline logging + background sync
- Dead zone detection (vibration + banner)
- Session recording + route saving
- Carrier comparison
- Local-first architecture (works on slow mobile data / offline)

## Architecture

### Local-First Pattern
- All user data saves to AsyncStorage first (instant)
- UI reads from local storage (never blocks on server)
- Background sync uploads to server when connected
- Server data merges with local for crowd-sourced features

### Signal Reading
- Native SignalModule uses SignalStrength API (primary) + CellInfo API (fallback)
- Dead zone threshold: -115 dBm
- Location: Google Play Services (GPS → network fallback)

### Data Flow
```
Phone Radio → SignalModule (Java) → signal-reader.ts → use-signal-logger
→ log-store (AsyncStorage) → sync-service → Server API → MongoDB
```

## Commands

### Debug Build
```
cd /c/dev/signalog/android && ./gradlew.bat app:installDebug
cd /c/Users/Joseph/OneDrive/Desktop/GHL/claude/signalogger/mobile && npx react-native start
adb reverse tcp:3000 tcp:3000 && adb reverse tcp:8081 tcp:8081
cd server && node index.js
```

### Release Build
```
cd /c/sl/mobile/android && ./gradlew.bat app:assembleRelease
adb install -r /c/sl/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Note: C:\sl is a git clone for short-path builds (Windows 260-char limit). Copy changed files from main repo before building.

## UI Development Rules

- After implementing any UI change, check for overlapping elements (especially floating buttons vs bottom sheets) and test overflow/scroll behavior before moving on
- Bottom sheets use `SwipeableSheet` component — match existing style (55% height, 20px border radius)
- Signal Summary card must render as bottom sheet, not floating overlay
- Test with both collapsed and expanded bottom sheet states

## Android / React Native

- Android SDK path: `C:\Users\Joseph\AppData\Local\Android\Sdk`
- **NEVER overwrite `local.properties`** — it contains `sdk.dir` and breaking it kills all builds
- Be cautious with native module changes — test builds after each change, not in batches
- Build uses short-path clone at `C:\sl` due to Windows 260-char path limit
- Always copy changed `mobile/src/` files to `C:\sl\mobile\src\` before building

## Known Issues / Decisions

- **Do NOT use react-native-maps** — causes Fabric/SIGSEGV crashes. Use the Leaflet/WebView approach instead
- Map tiles: use a tile server that doesn't block requests (not raw OSM)
- Fresh dots (< 24h) only show tooltips — no double-tap Signal Summary
- Consolidated dots ungroup into individual reading dots on double-tap

## Development Workflow

- Do minimal incremental changes and rebuild between each
- Do NOT batch multiple native-level changes together
- After each feature, verify it doesn't regress existing functionality
- Always run `./gradlew.bat app:assembleRelease` and test on device before marking done
- Copy files to `C:\sl` before building (short-path clone)

## Architecture Rules

- Feature-based structure
- No API logic in components
- Use hooks for logic
- Use services for signal, location, and API
- Local-first: never block UI for server calls
- mobile/src/ and src/ must stay in sync

## Important

Follow universal-build-discipline.md before building any feature.

Do NOT:

- Over-engineer
- Add login/auth yet
- Skip planning phase
- Block UI on server API calls (use local-first pattern)
