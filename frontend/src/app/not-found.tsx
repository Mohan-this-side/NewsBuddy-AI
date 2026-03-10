'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="inline-block p-8 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-xl">
          <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500 mb-4">
            404
          </h2>
          <p className="text-slate-400 mb-8 text-lg">Page not found</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-semibold shadow-lg"
          >
            Go back home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
