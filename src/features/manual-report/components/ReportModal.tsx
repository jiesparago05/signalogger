import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABELS } from '../../../lib/config';
import { ReportCategory, Attachment } from '../../../types/signal';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    category: ReportCategory;
    note: string;
    attachments: Attachment[];
  }) => void;
  currentCarrier: string;
  currentNetworkType: string;
}

export function ReportModal({
  visible,
  onClose,
  onSubmit,
  currentCarrier,
  currentNetworkType,
}: ReportModalProps) {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const handlePickPhoto = () => {
    Alert.alert('Add Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: () =>
          launchCamera({ mediaType: 'photo', quality: 0.8 }, (response) => {
            if (response.assets?.[0]) {
              const asset = response.assets[0];
              setAttachments((prev) => [
                ...prev,
                {
                  type: 'photo',
                  url: asset.uri || '',
                  size: asset.fileSize || 0,
                },
              ]);
            }
          }),
      },
      {
        text: 'Gallery',
        onPress: () =>
          launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
            if (response.assets?.[0]) {
              const asset = response.assets[0];
              setAttachments((prev) => [
                ...prev,
                {
                  type: 'photo',
                  url: asset.uri || '',
                  size: asset.fileSize || 0,
                },
              ]);
            }
          }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submittingRef = useRef(false);

  const handleSubmit = () => {
    if (submittingRef.current) return;
    if (!category) {
      Alert.alert('Error', 'Please select a report type');
      return;
    }
    submittingRef.current = true;
    onSubmit({ category, note, attachments });
    setCategory(null);
    setNote('');
    setAttachments([]);
    onClose();
    setTimeout(() => { submittingRef.current = false; }, 2000);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Report Signal Issue</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtnWrap}>
              <Text style={styles.closeBtn}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={styles.autoInfo}>
              {currentCarrier} {'\u00B7'} {currentNetworkType}
            </Text>

            <Text style={styles.label}>Report Type</Text>
            <View style={styles.categories}>
              {REPORT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, category === cat && styles.catChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[styles.catText, category === cat && styles.catTextActive]}
                  >
                    {REPORT_CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Describe the issue..."
              placeholderTextColor="#9CA3AF"
              value={note}
              onChangeText={setNote}
              maxLength={500}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.charCount}>{note.length}/500</Text>

            <Text style={styles.label}>Attachments</Text>
            <View style={styles.attachRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={handlePickPhoto}>
                <Text style={styles.attachIcon}>{'\uD83D\uDCF7'}</Text>
                <Text style={styles.attachLabel}>Photo</Text>
              </TouchableOpacity>
            </View>

            {attachments.length > 0 && (
              <Text style={styles.attachCount}>
                {attachments.length} file(s) attached
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitText}>Submit Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  title: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtnWrap: {
    padding: 4,
  },
  closeBtn: {
    color: '#9CA3AF',
    fontSize: 18,
  },
  body: {
    padding: 16,
  },
  autoInfo: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 16,
  },
  label: {
    color: '#F9FAFB',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 12,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  catChipActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  catText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  catTextActive: {
    color: '#F9FAFB',
  },
  noteInput: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    color: '#F9FAFB',
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#374151',
  },
  charCount: {
    color: '#9CA3AF',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
  },
  attachRow: {
    flexDirection: 'row',
    gap: 12,
  },
  attachBtn: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 12,
    alignItems: 'center',
    width: 70,
  },
  attachIcon: {
    fontSize: 24,
  },
  attachLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 4,
  },
  attachCount: {
    color: '#22C55E',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: '#22C55E',
    margin: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
});
