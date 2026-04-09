# Phase 2: Time-of-Day Heatmap Layer

> **Status:** Deferred. Do NOT start until Phase 1 (`2026-04-10-phase1-real-connectivity-capture.md`) has been shipped AND the app has enough data volume to make the feature visually meaningful.
>
> **Reviewed by ChatGPT 2026-04-10:** key feedback — "you are slightly ahead of your data maturity." Ship connectivity classification first; layer this on top later.

**Goal:** Expose a time-of-day filter on the heatmap that reveals congestion patterns. Same location, 7 AM vs 2 PM, can look completely different — because of tower congestion, backhaul saturation, and commuter density, not propagation. This is the differentiator no telco will ever publish and no speed-test app can capture.

**Why this is deferred:**
- With ~4 active test devices, most hour-buckets per cell will have < 5 readings for weeks. The feature will look broken early — empty cells, unreliable averages, confusing UX.
- Phase 1's richer per-reading fields (`validated`, `downKbps`) will make Phase 2 aggregations much more meaningful when the data volume arrives.
- Ship-before-ready on this feature risks burning the positioning ("the map that shows when your network sucks") if early users see a thin, unconvincing demo.

**Ship criteria — resume this plan when ALL of the following are true:**
- Phase 1 is live and stable on all test devices for at least 1 week
- At least 20 active devices are logging daily
- At least 3 commute routes have been mapped by multiple devices at different hours
- MongoDB query confirms ≥ 500 readings exist for a single cell across multiple hours (enough to populate at least a few hour-buckets meaningfully)

Until then: do not start. Re-read this plan when the criteria are met — the spec may need updating based on what was learned in Phase 1.

---

## Simplified Scope (per ChatGPT feedback)

Original plan had hour preset buttons (Morning Rush / Midday / Evening Rush / Night). Simplified:

- **Start with "All Day" default + a single-hour selector** (dropdown or simple slider 0–23).
- No preset buttons in v1 of this feature.
- No day-of-week split in v1.
- Presets and day-of-week are a potential Phase 3 once the raw feature is validated.

Rationale: users can discover patterns themselves. Presets encode an *assumption* ("rush hour is 6–9") that may not hold in the Philippines for all routes. Let the data inform the presets later.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `server/routes/heatmap.js` | Accept optional `hour` query param |
| `server/services/heatmap-service.js` | Add `$hour` match stage to aggregation (Asia/Manila timezone) |
| `mobile/src/features/map-view/components/MapScreen.tsx` | Hour selector UI (dropdown or slider) |
| `mobile/src/features/map-view/hooks/use-map-data.ts` | Pass `hour` to heatmap fetch |
| `mobile/src/lib/api/client.ts` | Extend heatmap client to accept `hour` |

Mirror `mobile/src/**` → root `src/**` per architecture rule.

---

## Prerequisites (must be true before starting)

1. Phase 1 is live and stable.
2. MongoDB `SignalLog` has sufficient data across multiple hours. Verify with a manual query:
   ```javascript
   db.signallogs.aggregate([
     { $group: {
         _id: { $hour: { date: '$timestamp', timezone: 'Asia/Manila' } },
         count: { $sum: 1 }
       }
     },
     { $sort: { _id: 1 } }
   ])
   ```
   Expected result: non-zero counts in at least 8 different hour buckets, with multiple hundreds per bucket.
3. Decide on the hour selector UX:
   - (a) Dropdown: simple, small footprint
   - (b) Slider: more tactile, better for exploration
   - Recommendation: **dropdown first** (smaller surface, simpler), upgrade to slider if users ask for it.

---

## Step 1 — Server Aggregation Endpoint

**Goal:** `GET /api/heatmap/tiles?hour=N` returns tiles filtered to readings whose `timestamp` hour (in Asia/Manila local time) equals N.

**Files:**
- Modify: `server/routes/heatmap.js`
- Modify: `server/services/heatmap-service.js`

- [ ] **Step 1.1: Read current heatmap aggregation**

Understand the existing pipeline (viewport match, carrier filter, grid grouping) before editing. Integrate the new match stage at the right position.

- [ ] **Step 1.2: Accept `hour` param in route**

```javascript
router.get('/tiles', validateBounds, parseFilters, async (req, res) => {
  const hourRaw = req.query.hour;
  let hour = null;
  if (hourRaw !== undefined && hourRaw !== 'all') {
    hour = parseInt(hourRaw, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      return res.status(400).json({ error: 'hour must be an integer 0-23 or "all"' });
    }
  }
  const result = await heatmapService.queryTiles(req.bounds, req.filters, hour);
  res.json(result);
});
```

- [ ] **Step 1.3: Add `$hour` match stage to aggregation**

```javascript
async function queryTiles(bounds, filters, hour) {
  const pipeline = [
    { $match: { /* existing viewport + carrier filter */ } },
  ];

  if (hour !== null && hour !== undefined) {
    pipeline.push({
      $match: {
        $expr: {
          $eq: [
            { $hour: { date: '$timestamp', timezone: 'Asia/Manila' } },
            hour,
          ],
        },
      },
    });
  }

  // ... existing grouping + projection stages

  return SignalLog.aggregate(pipeline);
}
```

**Important:** uses `timezone: 'Asia/Manila'` so "hour 8" means local time, not UTC. ChatGPT confirmed this syntax is correct and production-safe on Atlas. Stored timestamps must be in UTC (the Mongoose default) — double-check before deploying.

- [ ] **Step 1.4: Deploy to Render**

Standard push-to-master deploy. No schema changes — the aggregation just reads existing data differently.

- [ ] **Step 1.5: Smoke test the endpoint**

```bash
curl "https://signalogger.onrender.com/api/heatmap/tiles?sw_lng=120&sw_lat=14&ne_lng=122&ne_lat=15&hour=8"
curl "https://signalogger.onrender.com/api/heatmap/tiles?sw_lng=120&sw_lat=14&ne_lng=122&ne_lat=15&hour=14"
```

Compare: should return different (or partially different) cells if data volume is sufficient. If both return similar results, either the data is too thin or the query is broken — investigate before proceeding.

---

## Step 2 — Client Hour Selector

**Goal:** Map UI exposes an "All Day" default plus a simple hour selector that passes through to the heatmap fetch.

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`
- Modify: `mobile/src/features/map-view/hooks/use-map-data.ts`
- Modify: `mobile/src/lib/api/client.ts`

- [ ] **Step 2.1: Extend heatmap API client**

```typescript
// lib/api/client.ts
heatmap: {
  getTiles(bounds: Bounds, filters: Filters, hour?: number | null): Promise<HeatmapResult> {
    const params = new URLSearchParams({
      sw_lng: bounds.sw[0].toString(),
      sw_lat: bounds.sw[1].toString(),
      ne_lng: bounds.ne[0].toString(),
      ne_lat: bounds.ne[1].toString(),
    });
    if (filters.carrier?.length) params.append('carrier', filters.carrier.join(','));
    if (hour !== undefined && hour !== null) params.append('hour', hour.toString());
    return request(`/heatmap/tiles?${params.toString()}`);
  },
},
```

- [ ] **Step 2.2: Add hour state to MapScreen**

```typescript
const [hour, setHour] = useState<number | null>(null); // null = "all day"
```

- [ ] **Step 2.3: Add selector UI to filter bar**

Position it next to the existing carrier + network type filters. Recommend: dropdown labeled "Time" with values `All Day`, `12 AM`, `1 AM`, ..., `11 PM` (24 options + All Day).

- [ ] **Step 2.4: Pass `hour` through use-map-data hook**

```typescript
useEffect(() => {
  const data = await api.heatmap.getTiles(bounds, filters, hour);
  setTiles(data);
}, [bounds, filters, hour]);
```

- [ ] **Step 2.5: Show "low data" badge for thin buckets**

When `hour !== null` and the returned tiles have total `count` below a threshold (e.g., < 50 readings in viewport), show a banner:

> *"Limited data for this hour. More readings needed — try All Day for a fuller picture."*

Don't hide the data; just set the user's expectation. This is the "cold start" safety net.

- [ ] **Step 2.6: Bottom sheet / overlap check**

The filter bar addition should not overlap with the Signal Summary bottom sheet or any existing floating buttons. Test with sheet collapsed and expanded (per `bottom-sheet-overlap-check.md`).

---

## Step 3 — Field Validation

**Goal:** Confirm the feature actually reveals meaningful patterns with real data.

- [ ] **Step 3.1: Visual diff check**

Open the map, note a known busy area (e.g., SM North EDSA). Switch between `All Day`, `8 AM`, `2 PM`, `10 PM`. The colors should visibly differ if congestion patterns exist in the data. If they don't differ, either:
- Not enough data volume → revisit Ship Criteria
- Query is wrong → debug
- There genuinely is no time-of-day pattern yet → ok, feature works but has nothing to show

- [ ] **Step 3.2: Document findings**

In the memory system or a new doc, record what patterns emerged: did rush hours show degraded signal? Were there surprising results? This informs Phase 3 (presets, day-of-week, "best time to leave" advice).

- [ ] **Step 3.3: Decide on Phase 3**

Based on field data: do presets make sense? Is day-of-week worth adding? Is the "best time to leave" advice feature feasible?

---

## Open Questions (to revisit when starting this phase)

1. **Data staleness vs. recency.** "This cell at 8 AM historically" vs "this cell at 8 AM today" are different questions. Start with historical (simpler, more stable averages). Add real-time layer later if it proves valuable.

2. **Privacy / k-anonymity.** Publishing "cell X at 8 AM Tuesday has bad service" could be inferred as "someone commutes through here at that time." Consider minimum distinct-deviceId threshold per bucket before exposing (e.g., hide buckets with < 3 distinct devices). Revisit when user base grows.

3. **Cell size vs. sample count tradeoff.** The existing 50 m grid may be too fine-grained for hourly buckets at current data volume. May need to coarsen to 200 m for this feature specifically, or reuse the existing grid and accept sparser buckets.

4. **Should the hour filter persist across app launches?** Recommendation: no. Reset to "All Day" on launch. Sticky filters surprise users.

5. **Does `validated` deserve its own time-of-day layer?** Instead of "signal strength at hour 8," show "percentage of readings where internet was validated at hour 8." This is arguably the more useful metric and is the whole Phase 1 → Phase 2 synergy. Decide when starting Step 1 of this phase.

---

## Acceptance Criteria

- [ ] Heatmap endpoint accepts optional `hour` param (0–23 or "all")
- [ ] Aggregation correctly filters by Asia/Manila local hour
- [ ] Client map UI has a working hour selector
- [ ] Switching hours visibly changes the displayed tiles (when data is sufficient)
- [ ] Low-data banner shows when bucket has thin data
- [ ] No regressions: existing map, filters, sessions, sync all work
- [ ] Release APK field-tested

---

## Out of Scope (Phase 3 and later)

- **Hour preset buttons** (Morning Rush / Evening Rush / etc.)
- **Day-of-week filtering** (Monday 8 AM ≠ Sunday 8 AM)
- **"Best time to leave" advice** on saved routes
- **Per-hour validated / connectivity layer** (fancy version of this feature)
- **Event-driven anomaly layer** ("last concert at Araneta, signal degraded between 7–10 PM")
- **Active HTTP probes** and latency sampling
- **Pre-aggregated time-of-day `HeatmapTile` documents** (optimization — aggregate on-the-fly in v1)
