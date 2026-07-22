import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

interface ArticleEditorProps {
  visible: boolean;
  title: string;
  content: string;
  onSave: (title: string, content: string) => void;
  onClose: () => void;
}

export default function ArticleEditor({
  visible,
  title: initialTitle,
  content: initialContent,
  onSave,
  onClose,
}: ArticleEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);

  React.useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
  }, [initialTitle, initialContent, visible]);

  const handleSave = () => {
    if (!content.trim()) return;
    onSave(title, content);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {initialTitle ? 'Edit Article' : 'New Article'}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
            <Text style={[styles.saveText, !content.trim() && styles.disabled]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.titleInput}
            placeholder="Article Title"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />
          <TextInput
            style={styles.contentInput}
            placeholder="Paste or type your article here..."
            placeholderTextColor="#999"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            autoFocus={!initialContent}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  disabled: {
    opacity: 0.4,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  contentInput: {
    fontSize: 17,
    lineHeight: 28,
    color: '#333',
    minHeight: 300,
  },
});
