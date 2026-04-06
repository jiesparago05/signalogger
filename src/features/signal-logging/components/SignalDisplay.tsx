import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RawSignalReading } from '../services/signal-reader';
import { SignalStability } from '../hooks/use-signal-logger';
import { getSignalColor } from '../../../lib/config';
import { formatPing, signalLevelLabel } from '../../../lib/utils/signal-helpers';

interface SignalDisplayProps {
  signal: RawSignalReading | null;
  isLogging: boolean;
  stability?: SignalStability | null;
  compact?: boolean;
  inDeadZone?: boolean;
}

const STABILITY_COLORS = {
  Stable: '#22C55E',
  Fluctuating: '#EAB308',
  Unstable: '#EF4444',
};

const STABILITY_ICONS = {
  Stable: '\u25CF',
  Fluctuating: '\u26A0',
  Unstable: '\u25CF',
};

export function SignalDisplay({ signal, isLogging, stability, compact, inDeadZone }: SignalDisplayProps) {
  if (!signal) {
    return (
      <View style={styles.heroContainer}>
        <Text style={styles.noSignal}>Reading signal...</Text>
      </View>
    );
  }

  const noSignal = signal.networkType === 'none';
  const isReading = signal.signal.dbm <= -999 && !noSignal;
  const isDead = inDeadZone || noSignal;
  const color = isDead ? '#EF4444' : isReading ? '#9CA3AF' : getSignalColor(signal.signal.dbm);
  const level = isDead ? '\u2620\uFE0F Dead Zone' : isReading ? 'Reading signal...' : signalLevelLabel(signal.signal.dbm);
  const displayDbm = (isDead || isReading) ? '--' : String(signal.signal.dbm);

  if (compact) {
    const rangeText = isDead
      ? 'No signal available in this area'
      : isReading
        ? 'Waiting for signal data...'
        : stability
          ? `${stability.min} to ${stability.max}`
          : `${displayDbm} to ${displayDbm}`;
    const stabilityColor = isDead ? '#9CA3AF' : stability
      ? STABILITY_COLORS[stability.label]
      : '#9CA3AF';
    const stabilityText = (isDead || isReading) ? '' : stability
      ? `${STABILITY_ICONS[stability.label]} ${stability.label}`
      : 'Measuring...';

    return (
      <View style={styles.heroContainer}>
        <View style={styles.heroTop}>
          <View style={styles.heroSignal}>
            <Text style={[styles.heroDbm, { color }]}>{displayDbm}</Text>
            <Text style={styles.heroUnit}>dBm</Text>
          </View>
          {isLogging && (
            <View style={styles.loggingBadge}>
              <Text style={styles.loggingText}>{'\u25CF'} Mapping</Text>
            </View>
          )}
        </View>
        <Text style={[styles.heroLevel, { color }]}>{level}</Text>
        <Text style={styles.heroInfo}>
          {signal.carrier} {'\u00B7'} {isDead ? 'No Signal' : signal.networkType}
          {!isDead && signal.connection.ping ? ` ${'\u00B7'} ${formatPing(signal.connection.ping)}` : ''}
        </Text>

        <View style={styles.stabilityRow}>
          <Text style={styles.rangeText}>
            Range: {rangeText}
          </Text>
          <Text style={[styles.stabilityLabel, { color: stabilityColor }]}>
            {stabilityText}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { borderColor: color }]}>
        <Text style={[styles.dbm, { color }]}>{displayDbm}</Text>
        <Text style={styles.unit}>dBm</Text>
      </View>
      <Text style={[styles.level, { color }]}>{level}</Text>

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
  heroContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroSignal: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroDbm: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  heroUnit: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  heroLevel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  heroInfo: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
  },
  stabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  rangeText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  stabilityLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  loggingBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  loggingText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '600',
  },
  noSignal: {
    color: '#9CA3AF',
    fontSize: 14,
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
    color: '#9CA3AF',
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
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: 'bold',
  },
  metricLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 2,
  },
});
