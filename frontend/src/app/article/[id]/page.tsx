'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Article } from '@/types';
import { newsApi } from '@/lib/api';
import ArticleView from '@/components/ArticleView';
import CompanionPanel from '@/components/CompanionPanel';
import { motion } from 'framer-motion';

export default function ArticlePage() {
  const params = useParams();
  const articleId = params.id as string;
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArticle();
  }, [articleId]);

  const loadArticle = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await newsApi.getArticle(articleId);
      setArticle(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load article');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block"
          >
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
          </motion.div>
          <p className="mt-6 text-slate-400 text-lg">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="inline-block p-8 rounded-2xl bg-red-500/10 border border-red-500/30 backdrop-blur-xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-400 mb-6 text-lg font-semibold">{error || 'Article not found'}</p>
            <button
              onClick={loadArticle}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-semibold shadow-lg"
            >
              Try Again
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex overflow-hidden relative">
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Article */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="max-w-4xl mx-auto px-6 py-12 pb-48">
            <ArticleView article={article} />
          </div>
        </div>

        {/* Right Panel - AI Companion */}
        <div className="w-full md:w-96 lg:w-[500px] flex-shrink-0 border-l border-slate-800/50 h-full overflow-hidden">
          <CompanionPanel articleId={articleId} />
        </div>
      </div>
      
      {/* Fixed Bottom Panel - Article Interaction */}
      <div className="absolute bottom-0 left-0 right-0 md:right-[500px] lg:right-[500px] p-5 bg-slate-900/98 backdrop-blur-md border-t border-slate-700/50 shadow-2xl z-30">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col gap-3">
            {/* Suggested Questions - Larger and more prominent */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('companion-question', { detail: 'Why is this important?' }));
                }}
                className="px-5 py-3 text-base bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all border border-blue-500/30 font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                Why is this important?
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('companion-question', { detail: 'Tell me more about it' }));
                }}
                className="px-5 py-3 text-base bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all border border-blue-500/30 font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                Tell me more about it
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('companion-question', { detail: 'What are the key points?' }));
                }}
                className="px-5 py-3 text-base bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all border border-blue-500/30 font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                Key points
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('companion-question', { detail: 'Explain this in simple terms' }));
                }}
                className="px-5 py-3 text-base bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all border border-blue-500/30 font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                Explain simply
              </button>
            </div>
            
            {/* Input field */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Ask about the news..."
                className="flex-1 px-5 py-3.5 bg-slate-800/90 text-white text-base rounded-xl border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    window.dispatchEvent(new CustomEvent('companion-question', { detail: e.currentTarget.value.trim() }));
                    e.currentTarget.value = '';
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
