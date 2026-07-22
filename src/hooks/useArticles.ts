import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Article {
  id: string;
  title: string;
  content: string;
  progress: number;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = '@essay_reader_articles';
const CURRENT_KEY = '@essay_reader_current_id';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadArticles = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        const parsed: Article[] = JSON.parse(json);
        setArticles(parsed.sort((a, b) => b.updatedAt - a.updatedAt));
      }
      const cid = await AsyncStorage.getItem(CURRENT_KEY);
      setCurrentId(cid || null);
    } catch (e) {
      console.error('Failed to load articles', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const saveArticles = useCallback(async (updated: Article[]) => {
    setArticles(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addArticle = useCallback(async (title: string, content: string) => {
    const now = Date.now();
    const article: Article = {
      id: generateId(),
      title: title.trim() || 'Untitled',
      content,
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [article, ...articles];
    await saveArticles(updated);
    return article;
  }, [articles, saveArticles]);

  const updateArticle = useCallback(async (id: string, updates: Partial<Pick<Article, 'title' | 'content' | 'progress'>>) => {
    const updated = articles.map((a) =>
      a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
    );
    await saveArticles(updated);
  }, [articles, saveArticles]);

  const deleteArticle = useCallback(async (id: string) => {
    const updated = articles.filter((a) => a.id !== id);
    await saveArticles(updated);
    if (currentId === id) {
      setCurrentId(null);
      await AsyncStorage.removeItem(CURRENT_KEY);
    }
  }, [articles, saveArticles, currentId]);

  const selectArticle = useCallback(async (id: string | null) => {
    setCurrentId(id);
    if (id) {
      await AsyncStorage.setItem(CURRENT_KEY, id);
    } else {
      await AsyncStorage.removeItem(CURRENT_KEY);
    }
  }, []);

  const currentArticle = articles.find((a) => a.id === currentId) ?? null;

  return {
    articles,
    currentArticle,
    currentId,
    loading,
    addArticle,
    updateArticle,
    deleteArticle,
    selectArticle,
    reload: loadArticles,
  };
}
