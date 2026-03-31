import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface DataPoint {
  time: number;
  dbm: number;
}

interface SignalChartProps {
  data: DataPoint[];
  height?: number;
}

export function SignalChart({ data, height = 120 }: SignalChartProps) {
  if (data.length < 2) return null;

  const minTime = data[0].time;
  const maxTime = data[data.length - 1].time;
  const timeRange = maxTime - minTime || 1;
  const minDbm = Math.min(...data.map(d => d.dbm)) - 5;
  const maxDbm = Math.max(...data.map(d => d.dbm)) + 5;
  const dbmRange = maxDbm - minDbm || 1;

  const w = 350;
  const h = 80;
  const pad = 30;

  const points = data.map(d => {
    const x = pad + ((d.time - minTime) / timeRange) * (w - pad * 2);
    const y = h - (((d.dbm - minDbm) / dbmRange) * (h - 20)) - 10;
    return `${x},${y}`;
  }).join(' ');

  const startTime = new Date(minTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(maxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;background:#1F2937;}</style></head><body>
<svg width="100%" viewBox="0 0 ${w} ${h + 15}">
  <line x1="${pad}" y1="20" x2="${w - pad}" y2="20" stroke="#374151" stroke-width="0.5"/>
  <line x1="${pad}" y1="40" x2="${w - pad}" y2="40" stroke="#374151" stroke-width="0.5"/>
  <line x1="${pad}" y1="60" x2="${w - pad}" y2="60" stroke="#374151" stroke-width="0.5"/>
  <text x="2" y="23" fill="#9CA3AF" font-size="7">${maxDbm}</text>
  <text x="2" y="43" fill="#9CA3AF" font-size="7">${Math.round((maxDbm + minDbm) / 2)}</text>
  <text x="2" y="63" fill="#9CA3AF" font-size="7">${minDbm}</text>
  <polyline points="${points}" fill="none" stroke="#22C55E" stroke-width="2" stroke-linejoin="round"/>
  <text x="${pad}" y="${h + 12}" fill="#9CA3AF" font-size="8">${startTime}</text>
  <text x="${w - pad - 30}" y="${h + 12}" fill="#9CA3AF" font-size="8">${endTime}</text>
</svg></body></html>`;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#1F2937' },
  webview: { backgroundColor: '#1F2937' },
});
