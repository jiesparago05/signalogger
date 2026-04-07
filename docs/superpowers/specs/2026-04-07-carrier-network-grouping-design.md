# Carrier Network Grouping

## Overview

Philippine carriers have 6 SIM brands but only 3 actual networks. Smart/TNT/Sun share the same towers (PLDT). Globe/GOMO share the same towers. DITO is independent. Currently the app treats all 6 as separate carriers, making Smart vs TNT comparison meaningless since they're the same signal.

**Goal:** Group carrier brands by parent network in the filter UI. Selecting one brand auto-selects the entire network group. Default to user's network group on first load.

---

## Network Groups

```typescript
const NETWORK_GROUPS = {
  'Smart Network': ['Smart', 'TNT', 'Sun'],
  'Globe Network': ['Globe', 'GOMO'],
  'DITO': ['DITO'],
};
```

Reverse mapping for lookup:
```typescript
const CARRIER_TO_NETWORK = {
  Smart: 'Smart Network',
  TNT: 'Smart Network',
  Sun: 'Smart Network',
  Globe: 'Globe Network',
  GOMO: 'Globe Network',
  DITO: 'DITO',
};
```

---

## Changes

### 1. Grouped Dropdown UI

The carrier filter dropdown shows brands grouped under network headers.

**Layout:**
```
┌─────────────────────┐
│ SMART NETWORK       │  ← group header (gray, uppercase, small)
│  ● Smart            │
│  ● TNT              │
│  ● Sun              │
│─────────────────────│  ← divider
│ GLOBE NETWORK       │
│  ● Globe            │
│  ● GOMO             │
│─────────────────────│
│  ● DITO             │  ← standalone (no group header needed)
└─────────────────────┘
```

- Group headers are non-tappable labels
- Individual brand items are tappable
- Active brands show colored dot, inactive show gray

### 2. Network-Based Selection

Tapping any brand in a group selects **all brands in that network**.

**Behavior:**
- Tap "GOMO" → selects Globe + GOMO (both highlighted)
- Tap "Smart" → selects Smart + TNT + Sun (all highlighted)
- Tap "DITO" → selects DITO only
- Tap an already-selected brand → deselects the **entire network group**
- Selecting multiple network groups works (e.g., Smart Network + Globe Network)

**Implementation in `use-filters.ts`:**
- `toggleCarrier(carrier)` looks up the carrier's network group
- If any brand in that group is already selected → remove all brands in the group
- If no brand in that group is selected → add all brands in the group

### 3. Filter Chip Label

The filter chip at the top of the map should show a smart label:

| Selection | Chip Label |
|-----------|-----------|
| Nothing selected | "All Networks" |
| Smart + TNT + Sun (full group) | "Smart Network" |
| Globe + GOMO (full group) | "Globe Network" |
| DITO | "DITO" |
| Smart Network + Globe Network | "Smart + Globe" |
| All 3 networks selected | "All Networks" |

**Logic:** If all brands in a network group are selected, show the network name instead of listing individual brands.

### 4. Default to User's Network Group

On first load, auto-select the user's **entire network group** based on detected carrier.

- User has GOMO SIM → auto-select Globe + GOMO → chip shows "Globe Network"
- User has Smart SIM → auto-select Smart + TNT + Sun → chip shows "Smart Network"
- User has DITO SIM → auto-select DITO → chip shows "DITO"

Uses `setDefaultCarrier()` which already runs once on first signal detection. Updated to resolve the carrier's network group and select all brands in it.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/src/features/map-view/hooks/use-filters.ts` | Add `NETWORK_GROUPS`, `CARRIER_TO_NETWORK` mappings. Update `toggleCarrier` to select/deselect by network group. Update `setDefaultCarrier` to select full group. |
| `mobile/src/features/map-view/components/FilterChips.tsx` | Grouped dropdown layout with network headers + dividers. Updated chip label logic to show network names. |

Mirror to `src/` per architecture rule.

---

## Edge Cases

| Case | Handling |
|------|----------|
| Unknown carrier from native module | Falls back to selecting just that brand (no group) |
| User manually deselects one brand from a group | Deselects the entire group (network-level toggle) |
| All 3 network groups selected | Shows "All Networks" (same as empty selection) |
| Carrier not in any group | Treated as standalone, like DITO |

---

## What's NOT in Scope

- Merging carrier data in the database (Smart and TNT stay separate in MongoDB)
- Changing consolidation to group by network instead of carrier
- Renaming carriers in signal logs
- Carrier comparison redesign (future — compare networks instead of brands)
