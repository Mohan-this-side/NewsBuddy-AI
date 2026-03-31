'use client';

import { motion } from 'framer-motion';

interface VoiceButtonProps {
  isListening: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export default function VoiceButton({ isListening, onClick, disabled }: VoiceButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isListening}
      aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      title="Voice input works best in Chrome or Edge"
      className={`relative min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl flex items-center justify-center transition-colors shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
        isListening
          ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
          : 'bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      animate={isListening ? { scale: [1, 1.06, 1] } : {}}
      transition={{ duration: 1.2, repeat: isListening ? Infinity : 0, ease: 'easeInOut' }}
    >
      {isListening && (
        <>
          <span className="absolute inset-0 rounded-xl bg-red-500 opacity-35 animate-ping" aria-hidden />
          <span className="absolute inset-0 rounded-xl bg-red-500/25" aria-hidden />
        </>
      )}
      <svg
        className="w-6 h-6 text-white relative z-10 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    </motion.button>
  );
}
