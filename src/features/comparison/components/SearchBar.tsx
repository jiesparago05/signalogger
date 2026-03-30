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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setQuery(name);
    setResults([]);
    setFocused(false);
    onSelectLocation({
      lng: parseFloat(result.lon),
      lat: parseFloat(result.lat),
      name,
    });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search area..."
        placeholderTextColor="#9CA3AF"
        value={query}
        onChangeText={search}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {focused && results.length > 0 && (
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
  container: { position: 'absolute', top: 90, left: 12, right: 12, zIndex: 15 },
  input: {
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  dropdown: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginTop: 4,
    maxHeight: 200,
    elevation: 8,
  },
  resultItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  resultText: { color: '#F9FAFB', fontSize: 12 },
});
