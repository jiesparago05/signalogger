import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Share } from 'react-native';
import Slider from '@react-native-community/slider';
import { LoggingConfig, LoggingMode } from '../../../types/signal';
import { getDeviceId } from '../../../lib/config/device';
import { api } from '../../../lib/api/client';
import { getSyncStatus } from '../../offline-sync/services/sync-service';

interface SettingsSectionProps {
  config: LoggingConfig;
  onUpdateConfig: (config: Partial<LoggingConfig>) => void;
}

const MODES: { key: LoggingMode; label: string }[] = [
  { key: 'smart_hybrid', label: 'Smart Hybrid' },
  { key: 'time_only', label: 'Time' },
  { key: 'distance_only', label: 'Distance' },
];

export function SettingsSection({ config, onUpdateConfig }: SettingsSectionProps) {
  const syncStatus = getSyncStatus();

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const deviceId = await getDeviceId();
      const data = await api.export.getData(deviceId, format);
      const content = format === 'csv' ? data : JSON.stringify(data, null, 2);

      await Share.share({
        message: content,
        title: `Signalog Export (${format.toUpperCase()})`,
      });
    } catch (error: any) {
      Alert.alert('Export Failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Settings</Text>

      {/* Logging Mode */}
      <Text style={styles.label}>Logging Mode</Text>
      <View style={styles.modeRow}>
        {MODES.map((mode) => (
          <TouchableOpacity
            key={mode.key}
            style={[styles.modeChip, config.mode === mode.key && styles.modeChipActive]}
            onPress={() => onUpdateConfig({ mode: mode.key })}
          >
            <Text
              style={[styles.modeText, config.mode === mode.key && styles.modeTextActive]}
            >
              {mode.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stationary Interval */}
      <View style={styles.sliderRow}>
        <Text style={styles.label}>Stationary Interval</Text>
        <Text style={styles.sliderValue}>{config.stationaryIntervalMs / 1000}s</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={10000}
        maximumValue={300000}
        step={5000}
        value={config.stationaryIntervalMs}
        onValueChange={(v) => onUpdateConfig({ stationaryIntervalMs: v })}
        minimumTrackTintColor="#533483"
        maximumTrackTintColor="#333"
        thumbTintColor="#533483"
      />

      {/* Moving Distance */}
      <View style={styles.sliderRow}>
        <Text style={styles.label}>Moving Distance</Text>
        <Text style={styles.sliderValue}>{config.movingDistanceM}m</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={10}
        maximumValue={500}
        step={10}
        value={config.movingDistanceM}
        onValueChange={(v) => onUpdateConfig({ movingDistanceM: v })}
        minimumTrackTintColor="#533483"
        maximumTrackTintColor="#333"
        thumbTintColor="#533483"
      />

      {/* Sync Status */}
      <View style={styles.infoRow}>
        <Text style={styles.label}>Offline Queue</Text>
        <Text style={styles.infoValue}>
          {syncStatus.pendingSignals + syncStatus.pendingReports} pending
        </Text>
      </View>

      {/* Export */}
      <Text style={[styles.label, { marginTop: 16 }]}>Export Data</Text>
      <View style={styles.exportRow}>
        <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('csv')}>
          <Text style={styles.exportText}>Export CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('json')}>
          <Text style={styles.exportText}>Export JSON</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    color: '#e0e0e0',
    fontSize: 12,
    marginBottom: 6,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeChip: {
    backgroundColor: '#16213e',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modeChipActive: {
    backgroundColor: '#533483',
  },
  modeText: {
    color: '#aaa',
    fontSize: 12,
  },
  modeTextActive: {
    color: '#fff',
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderValue: {
    color: '#00ff88',
    fontSize: 12,
  },
  slider: {
    width: '100%',
    height: 30,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  infoValue: {
    color: '#ffaa00',
    fontSize: 12,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exportBtn: {
    backgroundColor: '#0f3460',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  exportText: {
    color: '#e0e0e0',
    fontSize: 13,
  },
});
