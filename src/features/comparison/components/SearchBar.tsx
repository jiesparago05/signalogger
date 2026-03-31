import React, { useState, useRef } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface SearchBarProps {
  onSelectLocation: (loc: { lng: number; lat: number; name: string }) => void;
}

export function SearchBar({ onSelectLocation }: SearchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const search = (text: string) => {
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

  const handleSelect = (result: SearchResult) => {
    const name = result.display_name.split(',')[0];
    setQuery('');
    setResults([]);
    setExpanded(false);
    onSelectLocation({
      lng: parseFloat(result.lon),
      lat: parseFloat(result.lat),
      name,
    });
  };

  const collapse = () => {
    setTimeout(() => {
      setExpanded(false);
      setQuery('');
      setResults([]);
    }, 200);
  };

  if (!expanded) {
    return (
      <View
        style={styles.iconBtn}
        onTouchEnd={() => {
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
      >
        <Text style={styles.iconText}>{'\uD83D\uDD0D'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.expandedContainer}>
      <View style={styles.inputRow}>
        <Text style={styles.searchIcon}>{'\uD83D\uDD0D'}</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Search area..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={search}
          onBlur={collapse}
          autoFocus
        />
      </View>
      {results.length > 0 && (
        <ScrollView style={styles.dropdown} keyboardShouldPersistTaps="handled">
          {results.map((r, i) => (
            <View key={i} style={styles.resultItem} onTouchEnd={() => handleSelect(r)}>
              <Text style={styles.resultText} numberOfLines={1}>{r.display_name}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    position: 'absolute',
    top: 48,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  iconText: {
    fontSize: 16,
  },
  expandedContainer: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 8,
  },
  dropdown: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginTop: 4,
    maxHeight: 200,
    elevation: 10,
  },
  resultItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  resultText: {
    color: '#F9FAFB',
    fontSize: 12,
  },
});
