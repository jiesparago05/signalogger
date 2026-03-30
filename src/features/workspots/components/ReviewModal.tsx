import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Modal, StyleSheet, Alert } from 'react-native';
import { CARRIERS } from '../../../lib/config';

interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { carrier: string; rating: string; comment: string }) => void;
  coordinates: [number, number];
}

const RATINGS = [
  { value: 'strong', label: 'Strong', color: '#22C55E' },
  { value: 'ok', label: 'OK', color: '#EAB308' },
  { value: 'weak', label: 'Weak', color: '#F97316' },
  { value: 'dead', label: 'Dead', color: '#EF4444' },
];

export function ReviewModal({ visible, onClose, onSubmit, coordinates }: ReviewModalProps) {
  const [carrier, setCarrier] = useState<string | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const submittingRef = useRef(false);

  const handleSubmit = () => {
    if (submittingRef.current) return;
    if (!carrier) { Alert.alert('Error', 'Please select a carrier'); return; }
    if (!rating) { Alert.alert('Error', 'Please select a rating'); return; }
    submittingRef.current = true;
    onSubmit({ carrier, rating, comment });
    setCarrier(null);
    setRating(null);
    setComment('');
    onClose();
    setTimeout(() => { submittingRef.current = false; }, 2000);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Review Signal Here</Text>
            <View onTouchEnd={onClose} style={styles.closeWrap}>
              <Text style={styles.closeBtn}>{'\u2715'}</Text>
            </View>
          </View>

          <View style={styles.body}>
            <Text style={styles.label}>Which carrier?</Text>
            <View style={styles.chipRow}>
              {CARRIERS.map((c) => (
                <View key={c} style={[styles.chip, carrier === c && styles.chipActive]} onTouchEnd={() => setCarrier(c)}>
                  <Text style={[styles.chipText, carrier === c && styles.chipTextActive]}>{c}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.label}>Signal rating</Text>
            <View style={styles.chipRow}>
              {RATINGS.map((r) => (
                <View key={r.value} style={[styles.chip, rating === r.value && { backgroundColor: `${r.color}20`, borderColor: r.color }]} onTouchEnd={() => setRating(r.value)}>
                  <Text style={[styles.chipText, rating === r.value && { color: r.color }]}>{r.label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.label}>Comment (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. "Malakas ang GOMO dito"'
              placeholderTextColor="#9CA3AF"
              value={comment}
              onChangeText={setComment}
              maxLength={200}
              multiline
            />
            <Text style={styles.charCount}>{comment.length}/200</Text>
          </View>

          <View style={styles.submitBtn} onTouchEnd={handleSubmit}>
            <Text style={styles.submitText}>Submit Review</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  title: { color: '#F9FAFB', fontSize: 18, fontWeight: 'bold' },
  closeWrap: { padding: 4 },
  closeBtn: { color: '#9CA3AF', fontSize: 18 },
  body: { padding: 16 },
  label: { color: '#F9FAFB', fontSize: 13, fontWeight: '500', marginBottom: 8, marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#1F2937', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#374151' },
  chipActive: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: '#22C55E' },
  chipText: { color: '#9CA3AF', fontSize: 12 },
  chipTextActive: { color: '#22C55E' },
  input: { backgroundColor: '#1F2937', borderRadius: 12, padding: 12, color: '#F9FAFB', fontSize: 14, textAlignVertical: 'top', minHeight: 60, borderWidth: 1, borderColor: '#374151' },
  charCount: { color: '#9CA3AF', fontSize: 10, textAlign: 'right', marginTop: 4 },
  submitBtn: { backgroundColor: '#22C55E', margin: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
