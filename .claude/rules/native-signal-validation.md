Native signal values from SignalModule may be cached or stale on app startup.

Rules:
- NEVER trigger dead zone alerts based on the first 1-2 signal readings after app start
- The consecutive readings threshold (DEAD_ZONE_CONSECUTIVE_READINGS) must be >= 3
- A dBm value of -999 means the native read failed — treat as "no data", NOT as dead zone
- Validate that networkType is not 'none' before treating low dBm as a dead zone
- The 5-minute cooldown (DEAD_ZONE_COOLDOWN_MS) prevents rapid repeated alerts

Key files:
- `mobile/src/features/signal-logging/services/signal-reader.ts` — reads from native module
- `mobile/src/features/dead-zone/hooks/use-dead-zone.ts` — dead zone detection logic
- `mobile/src/lib/config/index.ts` — thresholds and constants

Trigger: When modifying signal reading, dead zone detection, or alert logic.
