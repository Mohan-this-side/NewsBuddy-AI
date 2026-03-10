'use client';

import Link from 'next/link';
import { Article } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

interface NewsCardProps {
  article: Article;
  index?: number;
}

export default function NewsCard({ article, index = 0 }: NewsCardProps) {
  const timeAgo = formatDistanceToNow(new Date(article.published_at), { addSuffix: true });

  // Category color mapping
  const categoryColors: Record<string, string> = {
    ai: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
    sports: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
    geopolitics: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    business: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
    science: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30',
    trending: 'from-red-500/20 to-rose-500/20 border-red-500/30',
    hot: 'from-orange-500/20 to-red-500/20 border-orange-500/30',
  };

  const categoryColor = categoryColors[article.category.toLowerCase()] || 'from-slate-500/20 to-slate-600/20 border-slate-500/30';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group"
    >
      <Link href={`/article/${article.id}`}>
        <div className={`
          relative h-full rounded-2xl overflow-hidden
          bg-gradient-to-br ${categoryColor}
          border border-opacity-30 backdrop-blur-xl
          shadow-lg hover:shadow-2xl transition-all duration-500 ease-out
          cursor-pointer flex flex-col
          before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity
        `}>
          {/* Image Section */}
          {article.image_url ? (
            <div className="relative w-full h-56 overflow-hidden">
              <motion.img
                src={article.image_url}
                alt={article.title}
                className="w-full h-full object-cover"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute top-4 left-4">
                <span className={`
                  px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                  bg-black/40 backdrop-blur-md text-white border border-white/20
                `}>
                  {article.category}
                </span>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-32 bg-gradient-to-br from-slate-800/50 to-slate-900/50 flex items-center justify-center">
              <div className="absolute top-4 left-4">
                <span className={`
                  px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                  bg-black/40 backdrop-blur-md text-white border border-white/20
                `}>
                  {article.category}
                </span>
              </div>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
            </div>
          )}
          
          {/* Content Section */}
          <div className="p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {timeAgo}
              </span>
              <span className="text-xs text-slate-500 font-medium">{article.source}</span>
            </div>
            
            <h3 className="text-lg font-semibold text-white mb-3 line-clamp-2 group-hover:text-blue-400 transition-colors duration-300">
              {article.title}
            </h3>
            
            {article.description && (
              <p className="text-sm text-slate-300 line-clamp-3 mb-4 flex-1 leading-relaxed">
                {article.description}
              </p>
            )}
            
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
              <span className="text-xs text-slate-400 font-medium">{article.source}</span>
              <motion.span 
                className="text-blue-400 text-sm font-semibold flex items-center gap-2 group-hover:text-blue-300"
                whileHover={{ x: 4 }}
              >
                Read more
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
