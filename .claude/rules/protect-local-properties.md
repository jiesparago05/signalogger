NEVER overwrite or modify `local.properties` without explicit user approval.

This file contains `sdk.dir` which points to the Android SDK. If this file is corrupted or deleted, ALL builds break and the user loses significant time.

If you must modify it:
1. Read the current contents first
2. Show the user what you plan to change
3. Wait for approval
4. Back up the current sdk.dir value before any edit

Files protected:
- `mobile/android/local.properties`
- `C:\sl\mobile\android\local.properties`

Trigger: Before ANY edit to local.properties, gradle.properties, or Android config files.
