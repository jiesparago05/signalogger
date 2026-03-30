import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { CARRIERS, NETWORK_TYPES, getCarrierColor } from '../../../lib/config';
import { Carrier, NetworkType, FilterState } from '../../../types/signal';

interface FilterChipsProps {
  filters: FilterState;
  onToggleCarrier: (carrier: Carrier) => void;
  onToggleNetworkType: (type: NetworkType) => void;
}

type OpenMenu = 'carrier' | 'network' | null;

// Plain View tap handler — no Animated driver, no Fabric crashes
function Tap({ onPress, style, children }: { onPress: () => void; style?: any; children: React.ReactNode }) {
  return (
    <View
      style={style}
      onTouchEnd={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      {children}
    </View>
  );
}

export function FilterChips({ filters, onToggleCarrier, onToggleNetworkType }: FilterChipsProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const carrierLabel =
    filters.carriers.length === 0
      ? 'All Networks'
      : filters.carriers.length <= 2
        ? filters.carriers.join(' + ')
        : `${filters.carriers.length} Networks`;

  const networkLabel =
    filters.networkTypes.length === 0
      ? 'All Types'
      : filters.networkTypes[0];

  const networkTypes = NETWORK_TYPES.filter((t) => t !== 'none');

  const toggle = useCallback((menu: OpenMenu) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }, []);

  const handleCarrierPress = useCallback((item: Carrier) => {
    onToggleCarrier(item);
  }, [onToggleCarrier]);

  const handleNetworkPress = useCallback((item: NetworkType) => {
    onToggleNetworkType(item);
    // Auto-close after single selection
    setOpenMenu(null);
  }, [onToggleNetworkType]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Network carrier chip */}
        <View style={styles.dropdownWrapper}>
          <Tap
            style={[
              styles.chip,
              filters.carriers.length > 0 && styles.chipActive,
            ]}
            onPress={() => toggle('carrier')}
          >
            {filters.carriers.length > 0 && <View style={styles.chipDot} />}
            <Text style={styles.chipText}>
              {carrierLabel} {openMenu === 'carrier' ? '\u25B2' : '\u25BC'}
            </Text>
          </Tap>

          {openMenu === 'carrier' && (
            <View style={styles.dropdown}>
              <View style={styles.grid}>
                {CARRIERS.map((item) => {
                  const active = filters.carriers.includes(item);
                  return (
                    <Tap
                      key={item}
                      style={styles.gridItem}
                      onPress={() => handleCarrierPress(item)}
                    >
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: active ? getCarrierColor(item) : '#374151' },
                        ]}
                      />
                      <Text style={[styles.itemText, active && styles.itemTextActive]}>
                        {item}
                      </Text>
                    </Tap>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Network type chip */}
        <View style={styles.dropdownWrapper}>
          <Tap
            style={[
              styles.chip,
              filters.networkTypes.length > 0 && styles.chipActive,
            ]}
            onPress={() => toggle('network')}
          >
            {filters.networkTypes.length > 0 && <View style={styles.chipDot} />}
            <Text style={styles.chipText}>
              {networkLabel} {openMenu === 'network' ? '\u25B2' : '\u25BC'}
            </Text>
          </Tap>

          {openMenu === 'network' && (
            <View style={styles.dropdown}>
              {networkTypes.map((item) => {
                const active = filters.networkTypes.includes(item);
                return (
                  <Tap
                    key={item}
                    style={styles.listItem}
                    onPress={() => handleNetworkPress(item)}
                  >
                    <View
                      style={[
                        styles.dot,
                        active && styles.dotAccent,
                      ]}
                    />
                    <Text style={[styles.itemText, active && styles.itemTextActive]}>
                      {item}
                    </Text>
                  </Tap>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
  },
  dropdownWrapper: {
    zIndex: 20,
  },

  // Chip (pill button)
  chip: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  chipActive: {
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 6,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },

  // Dropdown container
  dropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    minWidth: 180,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 16,
    padding: 12,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    zIndex: 30,
  },

  // Network filter: 2-column grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },

  // Type filter: single column list
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },

  // Dot indicator
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#374151',
    marginRight: 8,
  },
  dotAccent: {
    backgroundColor: '#22C55E',
  },

  // Item text
  itemText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  itemTextActive: {
    color: '#FFFFFF',
  },
});
