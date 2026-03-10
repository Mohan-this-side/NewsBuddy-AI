'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { ttsApi } from '@/lib/api';
import AvatarCharacter from './AvatarCharacter';
import ChatMessages from './ChatMessages';
import VoiceButton from './VoiceButton';
import { motion, AnimatePresence } from 'framer-motion';

interface CompanionPanelProps {
  articleId: string;
}

type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function CompanionPanel({ articleId }: CompanionPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGreeting, setIsGreeting] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { playAudio, toggleMute, isMuted, isPlaying } = useAudioPlayback({
    onAmplitudeUpdate: setAmplitude,
  });

  // Ensure audio context is resumed on user interaction (browser autoplay policy)
  useEffect(() => {
    const handleUserInteraction = async () => {
      // Resume audio context on any user interaction
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        // This ensures audio can play after user interaction
        console.log('User interaction detected, audio context should be ready');
      }
    };
    
    // Add multiple event listeners to catch any user interaction
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true, passive: true });
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, []);

  const synthesizeAndPlay = useCallback(async (text: string) => {
    try {
      setAvatarState('speaking');
      setIsProcessing(true);
      
      console.log('🎤 Synthesizing speech for text:', text.substring(0, 100));
      console.log('🔊 Current mute state:', isMuted);
      
      // Ensure we're not muted before synthesizing
      if (isMuted) {
        console.warn('⚠️ Audio is muted, but synthesizing anyway for lip sync');
      }
      
      const audioBlob = await ttsApi.synthesize(text);
      console.log('✅ Audio blob received, size:', audioBlob.size, 'bytes');
      
      if (audioBlob.size === 0) {
        console.warn('⚠️ Received empty audio blob');
        setAvatarState('idle');
        setIsProcessing(false);
        return;
      }
      
      // Play audio (will respect mute state)
      console.log('▶️ Calling playAudio with blob size:', audioBlob.size);
      await playAudio(audioBlob);
      console.log('🔊 Audio playback initiated successfully');
      
      // Reset processing state after a delay to allow audio to start
      setTimeout(() => {
        setIsProcessing(false);
      }, 500);
    } catch (error) {
      console.error('❌ Error synthesizing speech:', error);
      setAvatarState('idle');
      setIsProcessing(false);
    }
  }, [playAudio, isMuted]);

  const handleWebSocketMessage = useCallback((wsMessage: any) => {
    console.log('WebSocket message received:', wsMessage);
    
    if (wsMessage.type === 'text') {
      const content = wsMessage.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
      
      // Check if this is a duplicate message
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        // Prevent duplicate consecutive messages
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === content) {
          console.log('Duplicate message detected, skipping');
          return prev;
        }
        
        const newMessage: ChatMessage = {
          role: 'assistant',
          content: content,
          timestamp: new Date(),
        };
        return [...prev, newMessage];
      });
      
      setAvatarState('speaking');
      setIsGreeting(false);
      
      // Synthesize and play audio
      if (content && content.length > 0) {
        // Small delay to ensure UI updates first
        setTimeout(() => {
          synthesizeAndPlay(content);
        }, 100);
      }
    } else if (wsMessage.type === 'thinking') {
      setAvatarState('thinking');
      setIsProcessing(true);
    } else if (wsMessage.type === 'error') {
      console.error('WebSocket error:', wsMessage.content);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: wsMessage.content || 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => {
        // Check for duplicate error messages too
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.content === errorMessage.content) {
          return prev;
        }
        return [...prev, errorMessage];
      });
      setAvatarState('idle');
      setIsProcessing(false);
      setIsGreeting(false);
    }
  }, [synthesizeAndPlay]);

  const { isConnected, sendMessage } = useWebSocket({
    articleId,
    onMessage: handleWebSocketMessage,
  });

  // Listen for questions from the article panel
  useEffect(() => {
    const handleCompanionQuestion = (event: CustomEvent) => {
      const question = event.detail;
      if (question && isConnected) {
        sendMessage(question);
        const userMessage: ChatMessage = {
          role: 'user',
          content: question,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setAvatarState('thinking');
        setIsProcessing(true);
        setIsGreeting(false);
      }
    };

    window.addEventListener('companion-question', handleCompanionQuestion as EventListener);
    return () => {
      window.removeEventListener('companion-question', handleCompanionQuestion as EventListener);
    };
  }, [isConnected, sendMessage]);

  const handleVoiceResult = useCallback((transcript: string) => {
    if (transcript.trim()) {
      sendMessage(transcript);
      const userMessage: ChatMessage = {
        role: 'user',
        content: transcript,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setAvatarState('thinking');
      setIsProcessing(true);
      setIsGreeting(false);
    }
  }, [sendMessage]);

  const {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    isSupported: isVoiceSupported,
  } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError: (error) => {
      console.error('Voice recognition error:', error);
      setAvatarState('idle');
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isListening) {
      setAvatarState('listening');
      setIsProcessing(false);
    } else if (isProcessing) {
      setAvatarState('thinking');
    } else if (!isProcessing && amplitude === 0 && !isListening) {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role === 'user') {
        setAvatarState('idle');
      }
    }
  }, [isListening, isProcessing, amplitude, messages]);

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && isConnected) {
      const query = inputText.trim();
      sendMessage(query);
      const userMessage: ChatMessage = {
        role: 'user',
        content: query,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputText('');
      setAvatarState('thinking');
      setIsProcessing(true);
      setIsGreeting(false);
    } else if (!isConnected) {
      alert('Not connected to AI companion. Please wait for connection...');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-l border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/30 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              AI Reporter Buddy
            </h3>
            <p className="text-sm text-slate-400 mt-1">Your news companion</p>
          </div>
          {isConnected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2 py-1 bg-green-500/20 rounded-full border border-green-500/30"
            >
              <span className="text-xs text-green-400 font-medium">● Live</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Avatar Section - Smaller but better sized */}
      <div className="h-40 flex-shrink-0 flex items-center justify-center bg-gradient-to-b from-slate-800/50 to-slate-900/50 border-b border-slate-700/50 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-pulse" />
        </div>
        
        <div className="relative z-10 scale-80">
          <AvatarCharacter state={avatarState} amplitude={amplitude} />
        </div>

        {/* Welcome message when idle and no messages - positioned above avatar */}
        {isGreeting && messages.length === 0 && isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-2 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-500/20 backdrop-blur-md rounded-lg border border-blue-500/30 z-20 shadow-lg"
          >
            <p className="text-sm text-blue-300 text-center font-medium">
              Preparing your news summary...
            </p>
          </motion.div>
        )}
      </div>

      {/* Chat Messages - Scrollable area */}
      <div className="flex-1 overflow-y-auto relative min-h-0" style={{ scrollbarWidth: 'thin' }}>
        <div className="p-4 space-y-4 pb-32">
          {messages.length === 0 && isConnected && !isGreeting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <p className="text-sm text-slate-400">
                Your AI reporter buddy is ready to chat...
              </p>
            </motion.div>
          )}
          <ChatMessages messages={messages} />
          {interimTranscript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 pb-2"
            >
              <div className="inline-block px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-sm text-slate-400 italic flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                  {interimTranscript}
                </p>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Section - Fixed at bottom, larger and properly positioned */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50 bg-slate-900/98 backdrop-blur-md shadow-2xl z-20" style={{ minHeight: '180px' }}>
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-2 px-3 mb-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30"
          >
            <p className="text-sm text-yellow-400 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              Connecting...
            </p>
          </motion.div>
        )}

        <form onSubmit={handleTextSubmit} className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isConnected ? "Ask about the news..." : "Connecting..."}
              className="w-full px-4 py-3 bg-slate-800/90 text-white text-sm rounded-xl border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 placeholder:text-slate-500"
              disabled={!isConnected}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSubmit(e as any);
                }
              }}
            />
          </div>
          
          {isVoiceSupported && (
            <VoiceButton
              isListening={isListening}
              onClick={handleVoiceToggle}
              disabled={!isConnected}
            />
          )}

          <motion.button
            type="submit"
            disabled={!isConnected || !inputText.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg disabled:shadow-none min-w-[48px] flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </motion.button>
        </form>

        {/* Quick action buttons - Larger - Only show when no messages yet */}
        {isConnected && messages.length === 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => {
                const question = "Why is this important?";
                sendMessage(question);
                const userMessage: ChatMessage = {
                  role: 'user',
                  content: question,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, userMessage]);
                setAvatarState('thinking');
                setIsProcessing(true);
                setIsGreeting(false);
              }}
              className="px-4 py-2.5 text-sm bg-gradient-to-r from-blue-600/80 to-purple-600/80 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all border border-blue-500/30 font-medium shadow-md hover:shadow-lg"
            >
              Why is this important?
            </button>
            <button
              onClick={() => {
                const question = "Tell me more about it";
                sendMessage(question);
                const userMessage: ChatMessage = {
                  role: 'user',
                  content: question,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, userMessage]);
                setAvatarState('thinking');
                setIsProcessing(true);
                setIsGreeting(false);
              }}
              className="px-4 py-2.5 text-sm bg-gradient-to-r from-blue-600/80 to-purple-600/80 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all border border-blue-500/30 font-medium shadow-md hover:shadow-lg"
            >
              Tell me more
            </button>
            <button
              onClick={() => {
                const question = "What are the key points?";
                sendMessage(question);
                const userMessage: ChatMessage = {
                  role: 'user',
                  content: question,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, userMessage]);
                setAvatarState('thinking');
                setIsProcessing(true);
                setIsGreeting(false);
              }}
              className="px-4 py-2.5 text-sm bg-gradient-to-r from-blue-600/80 to-purple-600/80 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all border border-blue-500/30 font-medium shadow-md hover:shadow-lg"
            >
              Key points
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <button
            onClick={toggleMute}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors duration-300 px-3 py-2 rounded-lg hover:bg-slate-800/60 font-medium"
          >
            {isMuted ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
                <span>Unmute</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <span>Mute</span>
              </>
            )}
          </button>
          <div className="flex items-center gap-2 text-slate-400">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            {isPlaying && (
              <span className={`flex items-center gap-1.5 ${isMuted ? 'text-slate-500' : 'text-blue-400'}`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${isMuted ? 'bg-slate-500' : 'bg-blue-400'}`} />
                <span className="font-medium">{isMuted ? 'Muted' : 'Speaking'}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
