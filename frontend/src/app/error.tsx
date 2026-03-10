'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
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
          <h2 className="text-2xl font-bold text-white mb-2">Something went wrong!</h2>
          <p className="text-slate-400 mb-6">{error.message}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-semibold shadow-lg"
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all font-semibold border border-slate-700"
            >
              Go home
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
