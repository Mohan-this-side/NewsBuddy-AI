'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { NewsResponse, NewsCategory } from '@/types';
import { newsApi } from '@/lib/api';
import NewsGrid from '@/components/NewsGrid';
import CategoryTabs from '@/components/CategoryTabs';
import { motion } from 'framer-motion';

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategoryNews();
  }, [slug]);

  const loadCategoryNews = async () => {
    try {
      setLoading(true);
      setError(null);
      const category = slug as NewsCategory;
      const data = await newsApi.getNews(category);
      setNews(data);
    } catch (err) {
      setError('Failed to load news. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const categoryLabels: Record<string, string> = {
    hot: 'Hot News',
    ai: 'AI & Technology',
    sports: 'Sports',
    geopolitics: 'Geopolitics',
    business: 'Business',
    science: 'Science',
    trending: 'Trending',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-cyan-500/10 via-blue-500/10 to-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <CategoryTabs />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl md:text-4xl font-bold text-white mb-8 capitalize bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent"
        >
          {categoryLabels[slug] || slug.replace('-', ' ')} News
        </motion.h2>

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
            <p className="mt-6 text-slate-400 text-lg">Loading news...</p>
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
                onClick={loadCategoryNews}
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
