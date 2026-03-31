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
import { motion } from 'framer-motion';

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
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** Serializes assistant TTS so the next clip only starts after the previous one finishes. */
  const ttsChainRef = useRef(Promise.resolve());

  const { playAudio, toggleMute, isMuted, isPlaying } = useAudioPlayback({
    onAmplitudeUpdate: setAmplitude,
  });

  useEffect(() => {
    const handleUserInteraction = () => {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        // Autoplay policy: further playback hooks resume in useAudioPlayback
      }
    };
    const events = ['click', 'touchstart', 'keydown', 'mousedown'] as const;
    events.forEach((event) => {
      document.addEventListener(event, handleUserInteraction, { once: true, passive: true });
    });
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, []);

  useEffect(() => {
    ttsChainRef.current = Promise.resolve();
  }, [articleId]);

  const enqueueSynthesizeAndPlay = useCallback(
    (text: string) => {
      ttsChainRef.current = ttsChainRef.current
        .then(async () => {
          try {
            setAvatarState('speaking');
            setIsProcessing(true);

            const audioBlob = await ttsApi.synthesize(text);

            if (audioBlob.size === 0) {
              setAvatarState('idle');
              setIsProcessing(false);
              return;
            }

            await playAudio(audioBlob);

            setTimeout(() => {
              setIsProcessing(false);
            }, 500);
          } catch (error) {
            console.error('Error synthesizing speech:', error);
            setAvatarState('idle');
            setIsProcessing(false);
          }
        })
        .catch(() => {
          /* keep chain alive */
        });
    },
    [playAudio]
  );

  const handleWebSocketMessage = useCallback(
    (wsMessage: {
      type: string;
      content?: string;
    }) => {
      if (wsMessage.type === 'text') {
        const content =
          wsMessage.content ||
          "I apologize, but I couldn't generate a response. Please try again.";

        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === content) {
            return prev;
          }
          const newMessage: ChatMessage = {
            role: 'assistant',
            content,
            timestamp: new Date(),
          };
          return [...prev, newMessage];
        });

        setAvatarState('speaking');
        setIsGreeting(false);

        if (content && content.length > 0) {
          setTimeout(() => {
            enqueueSynthesizeAndPlay(content);
          }, 100);
        }
      } else if (wsMessage.type === 'thinking') {
        setAvatarState('thinking');
        setIsProcessing(true);
      } else if (wsMessage.type === 'error') {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: wsMessage.content || 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => {
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
    },
    [enqueueSynthesizeAndPlay]
  );

  const { isConnected, sendMessage } = useWebSocket({
    articleId,
    onMessage: handleWebSocketMessage,
  });

  useEffect(() => {
    const handleCompanionQuestion = (event: Event) => {
      const question = (event as CustomEvent<string>).detail;
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

    window.addEventListener('companion-question', handleCompanionQuestion);
    return () => {
      window.removeEventListener('companion-question', handleCompanionQuestion);
    };
  }, [isConnected, sendMessage]);

  const handleVoiceResult = useCallback(
    (transcript: string) => {
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
    },
    [sendMessage]
  );

  const handleVoiceError = useCallback((code: string) => {
    console.error('Voice recognition error:', code);
    setAvatarState('idle');
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      setVoiceNotice('Microphone blocked. Allow mic access in your browser settings, or type your question.');
    } else if (code !== 'no-speech' && code !== 'aborted') {
      setVoiceNotice(`Voice input issue: ${code}. You can keep typing instead.`);
    }
  }, []);

  useEffect(() => {
    if (!voiceNotice) return undefined;
    const t = setTimeout(() => setVoiceNotice(null), 8000);
    return () => clearTimeout(t);
  }, [voiceNotice]);

  const { isListening, interimTranscript, startListening, stopListening, isSupported: isVoiceSupported } =
    useVoiceRecognition({
      onResult: handleVoiceResult,
      onError: handleVoiceError,
    });

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
    setVoiceNotice(null);
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
      setVoiceNotice('Still connecting to the reporter. Try again in a moment.');
    }
  };

  const voiceHint =
    isListening ? 'Listening… speak naturally. Tap the mic again to stop.' : 'Tap the mic to ask by voice (Chrome or Edge work best).';

  return (
    <div className="h-full min-h-0 flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-l border-slate-700/50 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-slate-700/50 bg-slate-800/30 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[0.9375rem] font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden />
              AI Reporter Buddy
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">Your news companion</p>
          </div>
          {isConnected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2 py-1 bg-green-500/20 rounded-full border border-green-500/30 shrink-0"
            >
              <span className="text-xs text-green-400 font-medium">Live</span>
            </motion.div>
          )}
        </div>
      </div>

      <div className="h-36 flex-shrink-0 flex items-center justify-center bg-gradient-to-b from-slate-800/50 to-slate-900/50 border-b border-slate-700/50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-pulse" />
        </div>

        <div className="relative z-10 scale-[0.85]">
          <AvatarCharacter state={avatarState} amplitude={amplitude} />
        </div>

        {isGreeting && messages.length === 0 && isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-500/20 backdrop-blur-md rounded-lg border border-blue-500/30 z-20 shadow-lg max-w-[90%]"
          >
            <p className="text-xs sm:text-sm text-blue-300 text-center font-medium">Preparing your news summary…</p>
          </motion.div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto relative min-h-0" style={{ scrollbarWidth: 'thin' }}>
        <div className="p-3 sm:p-4 space-y-4 pb-2">
          {voiceNotice && (
            <div
              role="status"
              className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2"
            >
              {voiceNotice}
            </div>
          )}
          {messages.length === 0 && isConnected && !isGreeting && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-sm text-slate-400 py-6">
              Your AI reporter buddy is ready to chat…
            </motion.p>
          )}
          <ChatMessages messages={messages} />
          {interimTranscript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-1 pb-1"
            >
              <div className="inline-block px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 max-w-[95%]">
                <p className="text-[0.8125rem] text-slate-300 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse mt-1.5 shrink-0" aria-hidden />
                  <span>{interimTranscript}</span>
                </p>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-slate-700/50 bg-slate-900/98 backdrop-blur-md p-3 sm:p-4 space-y-2 z-10">
        {!isConnected && (
          <div className="text-center py-2 px-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <p className="text-xs text-yellow-400 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shrink-0" aria-hidden />
              Connecting…
            </p>
          </div>
        )}

        <p className="text-[0.6875rem] text-slate-500 leading-snug">{voiceHint}</p>

        <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <label htmlFor="companion-input" className="sr-only">
              Message to AI reporter
            </label>
            <input
              id="companion-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isConnected ? 'Ask about the news…' : 'Connecting…'}
              className="w-full px-3 py-2.5 bg-slate-800/90 text-white text-[0.9375rem] rounded-xl border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder:text-slate-500"
              disabled={!isConnected}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSubmit(e as unknown as React.FormEvent);
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

          <button
            type="submit"
            disabled={!isConnected || !inputText.trim()}
            className="min-h-[44px] min-w-[44px] px-3 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg disabled:shadow-none flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span className="sr-only">Send</span>
          </button>
        </form>

        {isConnected && messages.length === 0 && (
          <div className="pt-1 flex flex-wrap gap-2">
            {(
              [
                ['Why is this important?', 'Why is this important?'],
                ['Tell me more', 'Tell me more about it'],
                ['Key points', 'What are the key points?'],
              ] as const
            ).map(([label, question]) => (
              <button
                key={question}
                type="button"
                onClick={() => {
                  sendMessage(question);
                  setMessages((prev) => [
                    ...prev,
                    { role: 'user', content: question, timestamp: new Date() },
                  ]);
                  setAvatarState('thinking');
                  setIsProcessing(true);
                  setIsGreeting(false);
                }}
                className="min-h-[40px] px-3 py-2 text-xs sm:text-sm bg-slate-800/90 text-slate-200 rounded-lg border border-slate-600/50 hover:bg-slate-700/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
          <button
            type="button"
            onClick={toggleMute}
            className="flex items-center gap-2 text-slate-300 hover:text-white px-2 py-2 rounded-lg hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {isMuted ? (
              <>
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
                Unmute
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
                Mute
              </>
            )}
          </button>
          <div className="flex items-center gap-2 text-slate-400 flex-wrap justify-end">
            <div className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green-500' : 'bg-slate-500'}`} aria-hidden />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            {isPlaying && (
              <span className={isMuted ? 'text-slate-500' : 'text-blue-400'}>
                {isMuted ? 'Muted playback' : 'Speaking'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
