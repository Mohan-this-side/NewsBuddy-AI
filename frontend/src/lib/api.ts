import axios from 'axios';
import { NewsResponse, Article, NewsCategory } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const newsApi = {
  getNews: async (category?: NewsCategory, page: number = 1, pageSize: number = 20): Promise<NewsResponse> => {
    const response = await api.get('/api/news', {
      params: { category, page, page_size: pageSize },
    });
    return response.data;
  },

  getTrending: async (page: number = 1, pageSize: number = 20): Promise<NewsResponse> => {
    const response = await api.get('/api/news/trending', {
      params: { page, page_size: pageSize },
    });
    return response.data;
  },

  getArticle: async (articleId: string): Promise<Article> => {
    const response = await api.get(`/api/news/article/${articleId}`);
    return response.data;
  },
};

export const ttsApi = {
  synthesize: async (text: string, voice: string = 'nova', provider: string = 'groq'): Promise<Blob> => {
    try {
      console.log('📞 Calling TTS API with text length:', text.length, 'voice:', voice, 'provider:', provider);
      const response = await api.post(
        '/api/tts/synthesize',
        { text, voice, provider },
        { 
          responseType: 'blob',
          timeout: 30000, // 30 second timeout
        }
      );
      
      if (!response.data || response.data.size === 0) {
        throw new Error('Received empty audio blob from server');
      }
      
      console.log('✅ TTS API response received, blob size:', response.data.size, 'bytes');
      return response.data;
    } catch (error: any) {
      console.error('❌ TTS API error:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  },
};
