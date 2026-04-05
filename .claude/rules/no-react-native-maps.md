NEVER use react-native-maps in this project. It causes Fabric/SIGSEGV native crashes that are unfixable.

Always use the Leaflet/WebView approach instead:
- Map renders inside a WebView with Leaflet JS
- Markers, overlays, and interactions use injected JavaScript
- Communication between React Native and map uses `postMessage` / `injectJavaScript`

Trigger: When adding map features, map libraries, or any geographic visualization.
