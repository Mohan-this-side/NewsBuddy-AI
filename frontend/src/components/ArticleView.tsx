'use client';

import { Article } from '@/types';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface ArticleViewProps {
  article: Article;
}

export default function ArticleView({ article }: ArticleViewProps) {
  const categoryColors: Record<string, string> = {
    ai: 'bg-gradient-to-r from-purple-500 to-pink-500',
    sports: 'bg-gradient-to-r from-green-500 to-emerald-500',
    geopolitics: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    business: 'bg-gradient-to-r from-yellow-500 to-orange-500',
    science: 'bg-gradient-to-r from-indigo-500 to-violet-500',
    trending: 'bg-gradient-to-r from-red-500 to-rose-500',
    hot: 'bg-gradient-to-r from-orange-500 to-red-500',
  };

  const categoryColor = categoryColors[article.category.toLowerCase()] || 'bg-gradient-to-r from-slate-500 to-slate-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="prose prose-invert max-w-none"
    >
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <span className={`px-4 py-2 rounded-full text-sm font-bold text-white uppercase tracking-wider ${categoryColor}`}>
            {article.category}
          </span>
          <span className="text-sm text-slate-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {format(new Date(article.published_at), 'MMMM d, yyyy')}
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
          {article.title}
        </h1>

        <div className="flex items-center gap-6 text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span className="font-semibold">{article.source}</span>
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline flex items-center gap-2 transition-colors"
          >
            Read original article
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {/* Image */}
      {article.image_url && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="mb-10 rounded-2xl overflow-hidden shadow-2xl"
        >
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full h-auto"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </motion.div>
      )}

      {/* Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        className="text-slate-200 leading-relaxed text-base"
      >
        {article.content ? (
          <div className="whitespace-pre-wrap space-y-4">{article.content}</div>
        ) : (
          <div className="space-y-4">
            {article.description && (
              <p className="text-base text-slate-300 leading-relaxed">{article.description}</p>
            )}
            <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-xl">
              <p className="text-slate-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Full article content is being loaded. Click the link above to read the original article.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
