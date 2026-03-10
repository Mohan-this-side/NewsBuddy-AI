'use client';

import { ChatMessage } from '@/types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessagesProps {
  messages: ChatMessage[];
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <div className="space-y-4">
      <AnimatePresence>
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
            )}
            <motion.div
              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-lg ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                  : 'bg-slate-800/80 backdrop-blur-sm text-slate-100 border border-slate-700/50'
              }`}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs opacity-60">
                  {format(message.timestamp, 'HH:mm')}
                </span>
                {message.role === 'assistant' && (
                  <span className="text-xs opacity-40">AI Reporter</span>
                )}
              </div>
            </motion.div>
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center ml-2 flex-shrink-0">
                <span className="text-white text-xs font-bold">You</span>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
