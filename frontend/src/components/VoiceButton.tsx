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
      onClick={onClick}
      disabled={disabled}
      className={`relative w-14 h-14 rounded-xl flex items-center justify-center transition-all shadow-lg ${
        isListening
          ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
          : 'bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      whileHover={disabled ? {} : { scale: 1.1 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      animate={isListening ? { scale: [1, 1.15, 1] } : {}}
      transition={{ duration: 1.2, repeat: isListening ? Infinity : 0, ease: "easeInOut" }}
    >
      {isListening && (
        <>
          <motion.div
            className="absolute inset-0 rounded-xl bg-red-500 opacity-40"
            animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-0 rounded-xl bg-red-500 opacity-30"
            animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
          />
        </>
      )}
      <svg
        className="w-6 h-6 text-white relative z-10"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
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
