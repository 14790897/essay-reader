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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {initialTitle ? 'Edit Article' : 'New Article'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.headerBtn}
            disabled={!content.trim()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text testID="editor-save-btn" style={[styles.saveText, !content.trim() && styles.disabled]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            testID="editor-title-input"
            style={styles.titleInput}
            placeholder="Article Title"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />
          <TextInput
            testID="editor-content-input"
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

        <View style={styles.bottomBar}>
          <TouchableOpacity
            testID="editor-save-bottom"
            style={[styles.saveBtn, !content.trim() && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!content.trim()}
            activeOpacity={0.7}
          >
            <Text style={styles.saveBtnText}>Save Article</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#fff',
    zIndex: 10,
  },
  headerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginHorizontal: 8,
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
    minHeight: 200,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  saveBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#007AFF',
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});