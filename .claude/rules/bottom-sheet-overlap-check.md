When adding floating UI elements (buttons, cards, overlays, modals), always check for bottom sheet overlap.

Checklist after any UI addition:
1. Does the new element overlap with SwipeableSheet when collapsed?
2. Does it overlap when the sheet is expanded (55% height)?
3. Does the content scroll properly if it exceeds available space?
4. Is the element positioned using the same pattern as existing overlays (sessionOverlay style)?

Common mistakes to avoid:
- Floating cards with `top: 30%` that overlap the bottom sheet
- Absolute-positioned elements that don't account for sheet height
- Content that overflows without ScrollView

Trigger: After implementing any UI change involving positioned elements, overlays, or bottom sheets.
