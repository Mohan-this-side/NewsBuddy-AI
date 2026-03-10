'use client';

import { Article } from '@/types';
import NewsCard from './NewsCard';

interface NewsGridProps {
  articles: Article[];
}

export default function NewsGrid({ articles }: NewsGridProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-block p-8 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-xl">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <p className="text-slate-400 text-lg">No articles found. Try another category.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {articles.map((article, index) => (
        <NewsCard key={article.id} article={article} index={index} />
      ))}
    </div>
  );
}
