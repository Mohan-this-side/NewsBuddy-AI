'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NewsCategory } from '@/types';
import { motion } from 'framer-motion';

const categories = [
  { slug: NewsCategory.HOT, label: 'Hot', emoji: '🔥', color: 'from-orange-500 to-red-500' },
  { slug: NewsCategory.AI, label: 'AI & Tech', emoji: '🤖', color: 'from-purple-500 to-pink-500' },
  { slug: NewsCategory.SPORTS, label: 'Sports', emoji: '⚽', color: 'from-green-500 to-emerald-500' },
  { slug: NewsCategory.GEOPOLITICS, label: 'Geopolitics', emoji: '🌍', color: 'from-blue-500 to-cyan-500' },
  { slug: NewsCategory.BUSINESS, label: 'Business', emoji: '💼', color: 'from-yellow-500 to-orange-500' },
  { slug: NewsCategory.SCIENCE, label: 'Science', emoji: '🔬', color: 'from-indigo-500 to-violet-500' },
];

export default function CategoryTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {categories.map((category, index) => {
        const isActive = pathname === `/category/${category.slug}` || 
                        (pathname === '/' && category.slug === NewsCategory.HOT);
        
        return (
          <motion.div
            key={category.slug}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
          >
            <Link
              href={category.slug === NewsCategory.HOT ? '/' : `/category/${category.slug}`}
            >
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  relative px-6 py-3 rounded-xl font-semibold text-sm
                  transition-all duration-300 ease-out cursor-pointer
                  ${isActive
                    ? `bg-gradient-to-r ${category.color} text-white shadow-lg shadow-${category.color.split('-')[1]}-500/50`
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 backdrop-blur-xl border border-slate-700/50'
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <span className="text-base">{category.emoji}</span>
                  <span>{category.label}</span>
                </span>
              </motion.div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
