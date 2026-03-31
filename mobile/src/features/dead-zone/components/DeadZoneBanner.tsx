import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DeadZoneBannerProps {
  visible: boolean;
}

export function DeadZoneBanner({ visible }: DeadZoneBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>{'\u26A0\uFE0F'}</Text>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Dead Zone — No Signal</Text>
        <Text style={styles.subtitle}>Data will sync when signal returns</Text>
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
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 100,
    borderRadius: 20,
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
