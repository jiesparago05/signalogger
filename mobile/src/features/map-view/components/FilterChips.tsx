import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CARRIERS, NETWORK_TYPES } from '../../../lib/config';
import { Carrier, NetworkType, FilterState } from '../../../types/signal';

interface FilterChipsProps {
  filters: FilterState;
  onToggleCarrier: (carrier: Carrier) => void;
  onToggleNetworkType: (type: NetworkType) => void;
}

export function FilterChips({ filters, onToggleCarrier, onToggleNetworkType }: FilterChipsProps) {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {CARRIERS.map((carrier) => (
          <TouchableOpacity
            key={carrier}
            style={[
              styles.chip,
              filters.carriers.includes(carrier) && styles.chipActive,
            ]}
            onPress={() => onToggleCarrier(carrier)}
          >
            <Text
              style={[
                styles.chipText,
                filters.carriers.includes(carrier) && styles.chipTextActive,
              ]}
            >
              {carrier}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {NETWORK_TYPES.filter((t) => t !== 'none').map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.chip,
              styles.chipNetwork,
              filters.networkTypes.includes(type) && styles.chipNetworkActive,
            ]}
            onPress={() => onToggleNetworkType(type)}
          >
            <Text
              style={[
                styles.chipText,
                filters.networkTypes.includes(type) && styles.chipTextActive,
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  chip: {
    backgroundColor: 'rgba(15, 52, 96, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: '#533483',
  },
  chipNetwork: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderWidth: 1,
    borderColor: '#333',
  },
  chipNetworkActive: {
    backgroundColor: '#533483',
    borderColor: '#533483',
  },
  chipText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
});
