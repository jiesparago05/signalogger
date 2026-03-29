import React, { useState } from 'react';
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

  const handleSubmit = () => {
    if (!category) {
      Alert.alert('Error', 'Please select a report type');
      return;
    }
    onSubmit({ category, note, attachments });
    // Reset form
    setCategory(null);
    setNote('');
    setAttachments([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Report Signal Issue</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={styles.autoInfo}>
              {currentCarrier} · {currentNetworkType}
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
              placeholderTextColor="#666"
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
                <Text style={styles.attachIcon}>📷</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    color: '#888',
    fontSize: 20,
    padding: 4,
  },
  body: {
    padding: 16,
  },
  autoInfo: {
    color: '#888',
    fontSize: 12,
    marginBottom: 16,
  },
  label: {
    color: '#e0e0e0',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 12,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    backgroundColor: '#16213e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  catChipActive: {
    backgroundColor: '#8a2a2a',
    borderColor: '#ff3344',
  },
  catText: {
    color: '#aaa',
    fontSize: 12,
  },
  catTextActive: {
    color: '#fff',
  },
  noteInput: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  charCount: {
    color: '#666',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
  },
  attachRow: {
    flexDirection: 'row',
    gap: 12,
  },
  attachBtn: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    width: 70,
  },
  attachIcon: {
    fontSize: 24,
  },
  attachLabel: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
  },
  attachCount: {
    color: '#00ff88',
    fontSize: 12,
    marginTop: 8,
  },
  submitBtn: {
    backgroundColor: '#533483',
    margin: 16,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
