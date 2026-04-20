// App version — bump manually before each release build.
//
// Displayed in the Sessions list footer so testers can visually confirm
// which build they're running. Also tagged onto every SignalLog as
// `clientVersion` so the server can identify stale clients without needing
// to ask the user.
//
// Versioning: MAJOR.MINOR.PATCH
// - MAJOR: breaking data model changes
// - MINOR: new user-visible features (e.g. Phase 1 = 1.1.0, Phase 2 = 1.2.0)
// - PATCH: bug fixes, no feature changes
//
// History:
// - 1.0.0 — pre-version-label baseline (implicit)
// - 1.1.0 — Phase 1 real-connectivity (validated / downKbps / dataState,
//           4-state classification, differentiated dead zone banner,
//           Signal Summary freshness + validated ratio). 2026-04-10.
// - 1.1.1 — Route Comparison per-km trail with on-tap segment label.
// - 1.1.2 — Cleanup of orphaned background service notification on app
//           startup. Fixes "stuck foreground notification" after app kill.
export const APP_VERSION = '1.1.2';
