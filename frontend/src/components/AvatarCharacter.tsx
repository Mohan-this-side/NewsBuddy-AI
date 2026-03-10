'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AvatarCharacterProps {
  state: AvatarState;
  amplitude?: number; // 0-1 for lip sync
}

export default function AvatarCharacter({ state, amplitude = 0 }: AvatarCharacterProps) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [mouthShape, setMouthShape] = useState<'closed' | 'slightly-open' | 'open' | 'wide' | 'very-wide'>('closed');
  const [headRotation, setHeadRotation] = useState(0);

  // Blink animation - more natural timing
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 120);
    }, 2500 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Subtle head movement when idle
  useEffect(() => {
    if (state === 'idle') {
      const interval = setInterval(() => {
        setHeadRotation(Math.sin(Date.now() / 2000) * 3);
      }, 50);
      return () => clearInterval(interval);
    } else {
      setHeadRotation(0);
    }
  }, [state]);

  // Enhanced lip sync based on amplitude
  useEffect(() => {
    if (state === 'speaking' && amplitude > 0) {
      if (amplitude > 0.8) {
        setMouthShape('very-wide');
      } else if (amplitude > 0.6) {
        setMouthShape('wide');
      } else if (amplitude > 0.35) {
        setMouthShape('open');
      } else if (amplitude > 0.15) {
        setMouthShape('slightly-open');
      } else {
        setMouthShape('closed');
      }
    } else {
      setMouthShape('closed');
    }
  }, [state, amplitude]);

  // Mouth shapes for lip sync
  const mouthShapes = {
    closed: 'M 48 78 Q 50 78 52 78',
    'slightly-open': 'M 46 78 Q 50 82 54 78',
    open: 'M 42 78 Q 50 88 58 78',
    wide: 'M 38 78 Q 50 92 62 78',
    'very-wide': 'M 35 78 Q 50 96 65 78',
  };

  // Eye states - ensure they're always numbers
  const eyeY = isBlinking ? 42 : 38;
  const eyeHeight = isBlinking ? 1 : 7;
  
  // Ensure mouth shape path is always defined
  const mouthPath = mouthShapes[mouthShape] || mouthShapes.closed;

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4">
      <motion.div
        className="relative"
        animate={{
          y: state === 'idle' ? [0, -8, 0] : 0,
          rotate: headRotation,
        }}
        transition={{
          duration: 4,
          repeat: state === 'idle' ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        {/* Glow effect when speaking */}
        <AnimatePresence>
          {state === 'speaking' && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-3xl opacity-40"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </AnimatePresence>

        {/* Reporter Badge/Name Tag */}
        {state === 'speaking' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 rounded-full shadow-lg"
          >
            <span className="text-white text-xs font-bold">AI Reporter</span>
          </motion.div>
        )}

        {/* SVG Reporter Avatar */}
        <svg
          width="220"
          height="220"
          viewBox="0 0 100 100"
          className="relative z-10 drop-shadow-2xl"
        >
          {/* Reporter Hat/Headwear */}
          <motion.g
            animate={{
              y: state === 'speaking' ? [0, -1, 0] : 0,
            }}
            transition={{
              duration: 0.3,
              repeat: state === 'speaking' ? Infinity : 0,
            }}
          >
            {/* Hat base */}
            <ellipse
              cx="50"
              cy="25"
              rx="28"
              ry="8"
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            {/* Hat top */}
            <rect
              x="42"
              y="15"
              width="16"
              height="12"
              rx="2"
              fill="#334155"
              stroke="#0f172a"
              strokeWidth="1"
            />
            {/* Press badge */}
            <circle
              cx="50"
              cy="20"
              r="4"
              fill="#fbbf24"
              stroke="#f59e0b"
              strokeWidth="0.5"
            />
            <text
              x="50"
              y="22"
              textAnchor="middle"
              className="text-[3px] font-bold fill-slate-900"
              fontSize="3"
            >
              PRESS
            </text>
          </motion.g>

          {/* Head */}
          <motion.circle
            cx="50"
            cy="50"
            r="32"
            fill="#475569"
            stroke="#334155"
            strokeWidth="2"
            animate={{
              scale: state === 'speaking' ? [1, 1.02, 1] : 1,
            }}
            transition={{
              duration: 0.5,
              repeat: state === 'speaking' ? Infinity : 0,
            }}
          />

          {/* Shirt/Body */}
          <motion.path
            d="M 30 70 Q 30 75 35 80 Q 40 85 50 85 Q 60 85 65 80 Q 70 75 70 70 L 70 82 Q 70 90 65 95 Q 60 100 50 100 Q 40 100 35 95 Q 30 90 30 82 Z"
            fill="#334155"
            stroke="#1e293b"
            strokeWidth="1.5"
            animate={{
              scaleY: state === 'speaking' ? [1, 1.05, 1] : 1,
            }}
            transition={{
              duration: 0.6,
              repeat: state === 'speaking' ? Infinity : 0,
            }}
          />

          {/* Microphone/Tie */}
          <motion.rect
            x="48"
            y="70"
            width="4"
            height="15"
            rx="2"
            fill="#64748b"
            animate={{
              y: state === 'speaking' ? [70, 72, 70] : 70,
            }}
            transition={{
              duration: 0.4,
              repeat: state === 'speaking' ? Infinity : 0,
            }}
          />
          <circle
            cx="50"
            cy="88"
            r="3"
            fill="#94a3b8"
          />

          {/* Eyes */}
          <motion.ellipse
            cx="42"
            cy={eyeY}
            rx="5"
            ry={eyeHeight || 7}
            fill="#ffffff"
            animate={{ ry: eyeHeight || 7 }}
            transition={{ duration: 0.12 }}
          />
          <motion.ellipse
            cx="58"
            cy={eyeY}
            rx="5"
            ry={eyeHeight || 7}
            fill="#ffffff"
            animate={{ ry: eyeHeight || 7 }}
            transition={{ duration: 0.12 }}
          />

          {/* Pupils with movement */}
          {!isBlinking && (
            <>
              <motion.circle
                cx="42"
                cy="38"
                r="2.5"
                fill="#1e293b"
                animate={{
                  x: state === 'listening' ? [0, 1, -1, 0] : 0,
                  y: state === 'listening' ? [0, 1, -1, 0] : 0,
                }}
                transition={{
                  duration: 2,
                  repeat: state === 'listening' ? Infinity : 0,
                }}
              />
              <motion.circle
                cx="58"
                cy="38"
                r="2.5"
                fill="#1e293b"
                animate={{
                  x: state === 'listening' ? [0, 1, -1, 0] : 0,
                  y: state === 'listening' ? [0, 1, -1, 0] : 0,
                }}
                transition={{
                  duration: 2,
                  repeat: state === 'listening' ? Infinity : 0,
                  delay: 0.1,
                }}
              />
            </>
          )}

          {/* Eyebrows - more expressive */}
          <motion.path
            d={
              state === 'thinking' || state === 'listening' 
                ? "M 36 30 Q 42 26 48 30"
                : state === 'speaking'
                ? "M 36 32 Q 42 30 48 32"
                : "M 36 31 Q 42 29 48 31"
            }
            stroke="#1e293b"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            transition={{ duration: 0.2 }}
          />
          <motion.path
            d={
              state === 'thinking' || state === 'listening'
                ? "M 52 30 Q 58 26 64 30"
                : state === 'speaking'
                ? "M 52 32 Q 58 30 64 32"
                : "M 52 31 Q 58 29 64 31"
            }
            stroke="#1e293b"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            transition={{ duration: 0.2 }}
          />

          {/* Mouth with enhanced lip sync */}
          <motion.path
            d={mouthPath}
            stroke="#ffffff"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            animate={{ d: mouthShapes[mouthShape] }}
            transition={{ duration: 0.08, ease: "easeOut" }}
          />

          {/* Cheeks when speaking */}
          {state === 'speaking' && (
            <motion.g
              animate={{
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
              }}
            >
              <circle cx="28" cy="58" r="6" fill="#f87171" opacity="0.4" />
              <circle cx="72" cy="58" r="6" fill="#f87171" opacity="0.4" />
            </motion.g>
          )}

          {/* Glasses (reporter style) */}
          <motion.g
            opacity={state === 'thinking' ? 0.6 : 0.3}
            transition={{ duration: 0.3 }}
          >
            <rect
              x="35"
              y="32"
              width="12"
              height="10"
              rx="2"
              fill="none"
              stroke="#64748b"
              strokeWidth="1"
            />
            <rect
              x="53"
              y="32"
              width="12"
              height="10"
              rx="2"
              fill="none"
              stroke="#64748b"
              strokeWidth="1"
            />
            <line
              x1="47"
              y1="37"
              x2="53"
              y2="37"
              stroke="#64748b"
              strokeWidth="1"
            />
          </motion.g>
        </svg>

        {/* Thinking animation */}
        <AnimatePresence>
          {state === 'thinking' && (
            <motion.div
              className="absolute -top-10 left-1/2 transform -translate-x-1/2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <div className="flex space-x-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 bg-blue-400 rounded-full"
                    animate={{
                      y: [0, -8, 0],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Listening indicator */}
        {state === 'listening' && (
          <motion.div
            className="absolute -bottom-4 left-1/2 transform -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full border border-red-500/30">
              <motion.div
                className="w-2 h-2 bg-red-500 rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-xs text-red-400 font-medium">Listening...</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
