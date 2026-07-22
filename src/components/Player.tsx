import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface PlayerProps {
  isSpeaking: boolean;
  isPaused: boolean;
  hasContent: boolean;
  isLoading?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function Player({
  isSpeaking,
  isPaused,
  hasContent,
  isLoading,
  onPlay,
  onPause,
  onResume,
  onStop,
}: PlayerProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, styles.secondaryBtn, !hasContent && styles.disabled]}
        onPress={onStop}
        disabled={!hasContent}
        activeOpacity={0.6}
      >
        <Text style={styles.iconText}>{'\u23EE'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.playBtn, !hasContent && styles.disabled]}
        onPress={() => {
          if (!isSpeaking) {
            onPlay();
          } else if (isPaused) {
            onResume();
          } else {
            onPause();
          }
        }}
        disabled={!hasContent}
        activeOpacity={0.6}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.iconText}>
            {isSpeaking && !isPaused ? '\u23F8' : '\u25B6\uFE0F'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.statusArea}>
        {isSpeaking ? (
          <Text style={styles.statusText}>
            {isLoading ? 'Synthesizing...' : isPaused ? 'Paused' : 'Reading...'}
          </Text>
        ) : (
          <Text style={styles.statusText}>
            {hasContent ? 'Ready' : 'Add an article'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    gap: 16,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryBtn: {
    backgroundColor: '#e8e8e8',
  },
  iconText: {
    fontSize: 24,
  },
  disabled: {
    opacity: 0.35,
  },
  statusArea: {
    position: 'absolute',
    right: 20,
  },
  statusText: {
    fontSize: 13,
    color: '#888',
  },
});
