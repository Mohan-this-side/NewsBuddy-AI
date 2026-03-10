'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { NewsCategory } from '@/types';
import { motion } from 'framer-motion';

const categories = [
  { slug: NewsCategory.HOT, label: 'Hot' },
  { slug: NewsCategory.AI, label: 'AI & Tech' },
  { slug: NewsCategory.SPORTS, label: 'Sports' },
  { slug: NewsCategory.GEOPOLITICS, label: 'Geopolitics' },
  { slug: NewsCategory.BUSINESS, label: 'Business' },
  { slug: NewsCategory.SCIENCE, label: 'Science' },
];

export default function Navbar() {
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${scrolled 
          ? 'bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/50 shadow-lg' 
          : 'bg-transparent'
        }
      `}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center space-x-3 group">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-xl">AI</span>
              </div>
            </motion.div>
            <div>
              <span className="text-xl font-bold text-white">News Reporter</span>
              <div className="text-xs text-slate-400 font-medium">Powered by AI</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-1">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-300 ease-out"
              >
                {category.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            {mounted && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  document.documentElement.classList.toggle('dark');
                }}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                aria-label="Toggle theme"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
