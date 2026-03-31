import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { CARRIERS, NETWORK_TYPES, getCarrierColor } from '../../../lib/config';
import { Carrier, NetworkType, FilterState } from '../../../types/signal';

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface FilterChipsProps {
  filters: FilterState;
  onToggleCarrier: (carrier: Carrier) => void;
  onToggleNetworkType: (type: NetworkType) => void;
  onSearchSelect?: (loc: { lng: number; lat: number; name: string }) => void;
}

type OpenMenu = 'carrier' | 'network' | null;

const CHIP_HEIGHT = 40;
const CHIP_BG = 'rgba(17, 24, 39, 0.85)';
const CHIP_BORDER = 'rgba(255, 255, 255, 0.08)';

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

export function FilterChips({ filters, onToggleCarrier, onToggleNetworkType, onSearchSelect }: FilterChipsProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

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
    setOpenMenu(null);
  }, [onToggleNetworkType]);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.length < 3) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&countrycodes=ph&limit=5`,
          { headers: { 'User-Agent': 'Signalog/1.0' } },
        );
        const data = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      }
    }, 1000);
  };

  const handleSelectResult = (result: SearchResult) => {
    const name = result.display_name.split(',')[0];
    Keyboard.dismiss();
    setQuery('');
    setResults([]);
    setSearchActive(false);
    onSearchSelect?.({
      lng: parseFloat(result.lon),
      lat: parseFloat(result.lat),
      name,
    });
  };

  const closeSearch = () => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    setSearchActive(false);
    setQuery('');
    setResults([]);
  };

  return (
    <>
      {/* Backdrop to catch taps when dropdown is open — prevents map tap-through */}
      {openMenu && (
        <View
          style={styles.backdrop}
          onTouchEnd={(e) => {
            e.stopPropagation();
            setOpenMenu(null);
          }}
        />
      )}
    <View style={styles.container}>
      {searchActive ? (
        // Search mode: full-width search bar
        <View style={styles.searchWrapper}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>{'\uD83D\uDD0D'}</Text>
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search area..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={handleSearch}
              autoFocus
            />
            <Tap onPress={closeSearch} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>{'\u2715'}</Text>
            </Tap>
          </View>
          {results.length > 0 && (
            <ScrollView style={styles.searchDropdown} keyboardShouldPersistTaps="handled">
              {results.map((r, i) => (
                <View key={i} style={styles.searchResultItem} onTouchEnd={() => handleSelectResult(r)}>
                  <Text style={styles.searchResultText} numberOfLines={1}>{r.display_name}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        // Default mode: search icon + filter chips
        <View style={styles.row}>
          <Tap
            style={styles.searchIconBtn}
            onPress={() => {
              setSearchActive(true);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
          >
            <Text style={styles.searchIconText}>{'\uD83D\uDD0D'}</Text>
          </Tap>

          {/* Network carrier chip */}
          <View style={styles.dropdownWrapper}>
            <Tap
              style={[styles.chip, filters.carriers.length > 0 && styles.chipActive]}
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
                      <Tap key={item} style={styles.gridItem} onPress={() => handleCarrierPress(item)}>
                        <View style={[styles.dot, { backgroundColor: active ? getCarrierColor(item) : '#374151' }]} />
                        <Text style={[styles.itemText, active && styles.itemTextActive]}>{item}</Text>
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
              style={[styles.chip, filters.networkTypes.length > 0 && styles.chipActive]}
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
                    <Tap key={item} style={styles.listItem} onPress={() => handleNetworkPress(item)}>
                      <View style={[styles.dot, active && styles.dotAccent]} />
                      <Text style={[styles.itemText, active && styles.itemTextActive]}>{item}</Text>
                    </Tap>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
    </>
  );
}

const chipBase = {
  height: CHIP_HEIGHT,
  backgroundColor: CHIP_BG,
  borderWidth: 1,
  borderColor: CHIP_BORDER,
  elevation: 6,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 12,
} as const;

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
  },
  container: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
  },

  // Search icon button (collapsed)
  searchIconBtn: {
    ...chipBase,
    width: CHIP_HEIGHT,
    borderRadius: CHIP_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconText: {
    fontSize: 16,
  },

  // Search bar (expanded)
  searchWrapper: {
    zIndex: 20,
  },
  searchBar: {
    ...chipBase,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: CHIP_HEIGHT / 2,
    paddingHorizontal: 14,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
    height: CHIP_HEIGHT,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 4,
  },
  closeBtnText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  searchDropdown: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginTop: 4,
    maxHeight: 200,
    elevation: 10,
  },
  searchResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  searchResultText: {
    color: '#F9FAFB',
    fontSize: 12,
  },

  // Filter chips
  dropdownWrapper: {
    zIndex: 20,
  },
  chip: {
    ...chipBase,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: CHIP_HEIGHT / 2,
  },
  chipActive: {
    borderColor: CHIP_BORDER,
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
    top: CHIP_HEIGHT + 4,
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
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
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
  itemText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  itemTextActive: {
    color: '#FFFFFF',
  },
});
