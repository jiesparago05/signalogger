import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DeadZoneReason } from '../hooks/use-dead-zone';

interface DeadZoneBannerProps {
  visible: boolean;
  reason?: DeadZoneReason | null;
}

export function DeadZoneBanner({ visible, reason }: DeadZoneBannerProps) {
  if (!visible) return null;

  // Default to NO_SIGNAL text for legacy callers / unknown reasons
  const isDataDead = reason === 'NO_INTERNET';
  const title = isDataDead ? 'No Internet — Signal OK' : 'Dead Zone — No Signal';
  const subtitle = isDataDead
    ? 'Check your data plan or network status'
    : 'Data will sync when signal returns';

  return (
    <View style={[styles.banner, isDataDead && styles.bannerDataDead]}>
      <Text style={styles.icon}>{'\u26A0\uFE0F'}</Text>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.95)', // red — NO_SIGNAL
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 100,
    borderRadius: 20,
  },
  bannerDataDead: {
    backgroundColor: 'rgba(220, 38, 38, 0.95)', // slightly different red for NO_INTERNET
    borderWidth: 2,
    borderColor: 'rgba(251, 146, 60, 0.9)', // orange ring distinguishes it
  },
  icon: {
    fontSize: 16,
  },
  textWrap: {},
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
  },
});
