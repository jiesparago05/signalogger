Always edit files in `mobile/src/`, NEVER in root `src/`.

- `mobile/src/` is the source of truth
- `src/` is a mirror — copy changes there AFTER editing `mobile/src/`
- Before every Edit tool call, verify the path starts with `mobile/src/`
- After all edits are done, mirror changed files: `cp mobile/src/... src/...`

Trigger: Before ANY file edit in the React Native app source code.
