import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RawSignalReading } from '../services/signal-reader';
import { getSignalColor } from '../../../lib/config';
import { formatDbm, formatPing, signalLevelLabel } from '../../../lib/utils/signal-helpers';

interface SignalDisplayProps {
  signal: RawSignalReading | null;
  isLogging: boolean;
  compact?: boolean;
}

export function SignalDisplay({ signal, isLogging, compact }: SignalDisplayProps) {
  if (!signal) {
    return (
      <View style={styles.container}>
        <Text style={styles.noSignal}>Reading signal...</Text>
      </View>
    );
  }

  const color = getSignalColor(signal.signal.dbm);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactLeft}>
          <Text style={[styles.dbmCompact, { color }]}>{signal.signal.dbm}</Text>
          <Text style={styles.unitCompact}>dBm</Text>
        </View>
        <View style={styles.compactRight}>
          <Text style={styles.infoText}>{signal.carrier} · {signal.networkType}</Text>
          {signal.connection.ping && (
            <Text style={styles.infoTextSub}>{formatPing(signal.connection.ping)}</Text>
          )}
        </View>
        {isLogging && (
          <View style={styles.loggingBadge}>
            <Text style={styles.loggingText}>● Logging</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { borderColor: color }]}>
        <Text style={[styles.dbm, { color }]}>{signal.signal.dbm}</Text>
        <Text style={styles.unit}>dBm</Text>
      </View>
      <Text style={[styles.level, { color }]}>{signalLevelLabel(signal.signal.dbm)}</Text>

      <View style={styles.metricsRow}>
        <MetricItem label="Network" value={signal.networkType} />
        <MetricItem label="Carrier" value={signal.carrier} />
        <MetricItem label="Ping" value={formatPing(signal.connection.ping)} />
      </View>

      {(signal.signal.snr || signal.signal.cellId || signal.signal.bandFrequency) && (
        <View style={styles.metricsRow}>
          {signal.signal.snr && <MetricItem label="SNR" value={`${signal.signal.snr}`} />}
          {signal.signal.cellId && <MetricItem label="Cell ID" value={signal.signal.cellId} />}
          {signal.signal.bandFrequency && (
            <MetricItem label="Band" value={`${signal.signal.bandFrequency} MHz`} />
          )}
        </View>
      )}
    </View>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 12,
  },
  compactRight: {
    flex: 1,
  },
  dbmCompact: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  unitCompact: {
    fontSize: 11,
    color: '#999',
    marginLeft: 2,
  },
  infoText: {
    color: '#333',
    fontSize: 13,
  },
  infoTextSub: {
    color: '#777',
    fontSize: 11,
  },
  loggingBadge: {
    backgroundColor: '#533483',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  loggingText: {
    color: '#fff',
    fontSize: 11,
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dbm: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: 12,
    color: '#888',
  },
  level: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 8,
  },
  metric: {
    alignItems: 'center',
    minWidth: 80,
  },
  metricValue: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: 'bold',
  },
  metricLabel: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
  },
  noSignal: {
    color: '#888',
    fontSize: 14,
  },
});
