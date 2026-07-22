import React, { useMemo } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';

interface ReaderProps {
  content: string;
  currentSentenceIndex: number;
  sentenceBoundaries: number[];
  fontSize: number;
}

export default function Reader({
  content,
  currentSentenceIndex,
  sentenceBoundaries,
  fontSize,
}: ReaderProps) {
  const sentences = useMemo(() => {
    if (!content) return [];
    if (sentenceBoundaries.length < 2) return [content];

    const result: string[] = [];
    for (let i = 0; i < sentenceBoundaries.length - 1; i++) {
      result.push(
        content.slice(sentenceBoundaries[i], sentenceBoundaries[i + 1])
      );
    }
    return result;
  }, [content, sentenceBoundaries]);

  if (!content) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyContainer}
      >
        <Text style={styles.emptyIcon}>📖</Text>
        <Text style={styles.emptyText}>No article selected</Text>
        <Text style={styles.emptySubtext}>
          Tap the list icon to choose an article
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
    >
      {sentences.map((sentence, i) => (
        <Text
          key={i}
          style={[
            styles.sentence,
            { fontSize },
            i === currentSentenceIndex && styles.activeSentence,
          ]}
        >
          {sentence}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 17,
    color: '#888',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 4,
  },
  sentence: {
    color: '#555',
    lineHeight: 32,
    marginBottom: 4,
  },
  activeSentence: {
    color: '#1a1a1a',
    fontWeight: '600',
    backgroundColor: '#FFF3CD',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
});
