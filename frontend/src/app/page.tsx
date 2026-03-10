'use client';

import { useEffect, useState } from 'react';
import { NewsResponse, NewsCategory } from '@/types';
import { newsApi } from '@/lib/api';
import NewsGrid from '@/components/NewsGrid';
import CategoryTabs from '@/components/CategoryTabs';
import { motion } from 'framer-motion';

export default function Home() {
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await newsApi.getTrending();
      setNews(data);
    } catch (err) {
      setError('Failed to load news. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-cyan-500/10 via-blue-500/10 to-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-block mb-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-xl opacity-50" />
              <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 rounded-2xl">
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                  AI News Reporter
                </h1>
              </div>
            </div>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed"
          >
            Your intelligent news companion powered by AI. 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-semibold">
              {' '}Read, understand, and converse{' '}
            </span>
            with articles through natural voice interactions.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
            className="mt-8 flex items-center justify-center gap-4 text-sm text-slate-400"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Live News Updates</span>
            </div>
            <div className="w-1 h-1 bg-slate-600 rounded-full" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span>AI-Powered Insights</span>
            </div>
            <div className="w-1 h-1 bg-slate-600 rounded-full" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              <span>Voice Conversations</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-12"
        >
          <CategoryTabs />
        </motion.div>

        {/* News Grid */}
        {loading && (
          <div className="text-center py-20">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-block"
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
              </div>
            </motion.div>
            <p className="mt-6 text-slate-400 text-lg">Loading latest news...</p>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="inline-block p-6 rounded-2xl bg-red-500/10 border border-red-500/30 backdrop-blur-xl">
              <p className="text-red-400 mb-4 text-lg">{error}</p>
              <button
                onClick={loadNews}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-semibold shadow-lg"
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}

        {!loading && !error && news && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <NewsGrid articles={news.articles} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
