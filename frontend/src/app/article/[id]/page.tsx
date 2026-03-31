'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Article } from '@/types';
import { newsApi } from '@/lib/api';
import ArticleView from '@/components/ArticleView';
import CompanionPanel from '@/components/CompanionPanel';
import { motion } from 'framer-motion';

const SUGGESTED_ACTIONS = [
  { label: 'Why is this important?', detail: 'Why is this important?' },
  { label: 'Tell me more about it', detail: 'Tell me more about it' },
  { label: 'Key points', detail: 'What are the key points?' },
  { label: 'Explain simply', detail: 'Explain this in simple terms' },
];

function dispatchCompanionQuestion(detail: string) {
  window.dispatchEvent(new CustomEvent('companion-question', { detail }));
}

export default function ArticlePage() {
  const params = useParams();
  const articleId = params.id as string;
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadArticle();
  }, [articleId]);

  const loadArticle = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await newsApi.getArticle(articleId);
      setArticle(data);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      setError(ax.response?.data?.detail || 'Failed to load article');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex flex-col w-full max-w-[100vw] min-h-0 h-[calc(100dvh-5rem)] overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
        aria-busy="true"
        aria-label="Loading article"
      >
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 flex-1">
          <div className="h-8 w-32 bg-slate-800 rounded-lg mb-6 animate-pulse" />
          <div className="h-10 w-full bg-slate-800 rounded-lg mb-4 animate-pulse" />
          <div className="h-10 w-4/5 bg-slate-800 rounded-lg mb-8 animate-pulse" />
          <div className="aspect-[16/9] max-h-64 w-full bg-slate-800 rounded-2xl mb-8 animate-pulse" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-slate-800/80 rounded animate-pulse" />
            <div className="h-4 w-full bg-slate-800/80 rounded animate-pulse" />
            <div className="h-4 w-11/12 bg-slate-800/80 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-[calc(100dvh-5rem)] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
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
              type="button"
              onClick={loadArticle}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row w-full max-w-[100vw] min-h-0 h-[calc(100dvh-5rem)] overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Reading column: left on desktop — article + docked ask strip */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0 basis-0">
        <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            <ArticleView article={article} />
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-slate-700/50 bg-slate-900/95 backdrop-blur-md supports-[backdrop-filter]:bg-slate-900/85 shadow-[0_-6px_20px_rgba(0,0,0,0.2)]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ask about this story</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {SUGGESTED_ACTIONS.map(({ label, detail }) => (
                <button
                  key={detail}
                  type="button"
                  onClick={() => dispatchCompanionQuestion(detail)}
                  className="min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white border border-blue-500/30 shadow-md hover:from-blue-500 hover:to-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            <label htmlFor="article-ask-input" className="sr-only">
              Ask the AI reporter about this article
            </label>
            <input
              id="article-ask-input"
              ref={articleInputRef}
              type="text"
              placeholder="Type a question for the reporter…"
              className="w-full min-h-[48px] px-4 py-3 bg-slate-800/90 text-white text-[0.9375rem] rounded-xl border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder:text-slate-500"
              onKeyDown={(e) => {
                const v = e.currentTarget.value.trim();
                if (e.key === 'Enter' && v) {
                  dispatchCompanionQuestion(v);
                  e.currentTarget.value = '';
                  e.preventDefault();
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Buddy column: right on sm+ — fixed-width rail, full viewport height */}
      <div className="flex flex-col h-full w-full sm:w-[min(22rem,40vw)] md:w-96 lg:w-[31.25rem] flex-shrink-0 border-slate-800/50 border-t sm:border-t-0 sm:border-l max-h-[48vh] sm:max-h-none sm:min-h-0">
        <CompanionPanel articleId={articleId} />
      </div>
    </div>
  );
}
