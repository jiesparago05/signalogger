This project runs on Windows with a 260-character path limit.

Rules:
- Keep all file paths under 200 characters (leave margin for build artifacts)
- The main repo is at a long path: `C:\Users\Joseph\OneDrive\Desktop\GHL\claude\signalogger`
- Builds use a short-path clone at `C:\sl` to avoid path limit issues
- Always copy changed files from main repo to `C:\sl` before building
- NEVER create deeply nested directory structures
- Keep feature/component names concise

Build workflow:
1. Edit files in main repo (`mobile/src/...`)
2. Copy to short-path clone (`cp mobile/src/... /c/sl/mobile/src/...`)
3. Build from short path (`cd /c/sl/mobile/android && ./gradlew.bat app:assembleRelease`)
4. Install APK (`adb install -r /c/sl/mobile/android/app/build/outputs/apk/release/app-release.apk`)

Trigger: When creating new files, directories, or modifying the build process.
