'use client';

import Link from 'next/link';
import { Article } from '@/types';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface ArticleViewProps {
  article: Article;
}

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI & Tech',
  sports: 'Sports',
  geopolitics: 'Geopolitics',
  business: 'Business',
  science: 'Science',
  trending: 'Trending',
  hot: 'Hot',
};

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

  const cat = article.category.toLowerCase();
  const categoryColor = categoryColors[cat] || 'bg-gradient-to-r from-slate-500 to-slate-600';
  const categoryLabel = CATEGORY_LABELS[cat] || article.category;
  const truncatedTitle =
    article.title.length > 56 ? `${article.title.slice(0, 54)}…` : article.title;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="prose prose-invert max-w-none"
    >
      <nav className="not-prose mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/category/${article.category}`}
          className="hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          {categoryLabel}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-slate-500 truncate max-w-[12rem] sm:max-w-md" title={article.title}>
          {truncatedTitle}
        </span>
      </nav>

      <div className="not-prose mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold text-white uppercase tracking-wider ${categoryColor}`}>
            {article.category}
          </span>
          <span className="text-sm text-slate-400 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
            {format(new Date(article.published_at), 'MMMM d, yyyy')}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-5 leading-tight bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
          {article.title}
        </h1>

        {article.content_tier && article.content_tier !== 'full' && (
          <p
            className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-5"
            role="status"
          >
            {article.content_tier === 'metadata_only'
              ? 'Limited text: only a headline and short excerpt are available in-app; answers stay within that text.'
              : 'Partial article text in-app; the reporter uses the excerpt and any fetched body below.'}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
            <span className="font-medium text-slate-300">{article.source}</span>
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline flex items-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            Read original article
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {article.image_url && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="not-prose mb-8 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-700/50"
        >
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full max-h-[min(50vh,28rem)] object-cover object-center"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
        className="text-[0.9375rem] md:text-base text-slate-200 leading-7"
      >
        {article.content ? (
          <div className="space-y-6">
            {article.description &&
              (article.content_tier === 'snippet' || article.content_tier === 'metadata_only') && (
                <p className="text-[0.9375rem] md:text-base text-slate-300/95 leading-7 border-l-2 border-blue-500/40 pl-4 italic">
                  {article.description}
                </p>
              )}
            <div className="whitespace-pre-wrap space-y-4">{article.content}</div>
          </div>
        ) : (
          <div className="space-y-4">
            {article.description && (
              <p className="text-[0.9375rem] md:text-base text-slate-300 leading-7">{article.description}</p>
            )}
            <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-xl">
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Full article content is being loaded. Please wait a moment or try refreshing.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.article>
  );
}
