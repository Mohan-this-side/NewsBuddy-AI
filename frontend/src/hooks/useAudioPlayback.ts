import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioPlaybackOptions {
  onAmplitudeUpdate?: (amplitude: number) => void;
}

export function useAudioPlayback({ onAmplitudeUpdate }: UseAudioPlaybackOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const htmlAudioUrlRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    // Initialize AudioContext
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      // Use user gesture to create AudioContext
      const initAudioContext = async () => {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 512; // Higher resolution for better lip sync
          analyserRef.current.smoothingTimeConstant = 0.8; // Smooth transitions
          
          // Try to resume immediately if suspended
          if (audioContextRef.current.state === 'suspended') {
            console.log('AudioContext suspended, will resume on user interaction');
          } else {
            console.log('AudioContext initialized successfully');
          }
        } catch (error) {
          console.error('Error initializing AudioContext:', error);
        }
      };
      
      // Initialize on any user interaction
      const resumeOnInteraction = async () => {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          try {
            await audioContextRef.current.resume();
            console.log('✅ AudioContext resumed on user interaction');
          } catch (error) {
            console.error('Error resuming AudioContext:', error);
          }
        }
      };
      
      // Try to initialize immediately
      initAudioContext();
      
      // Also listen for user interactions to resume
      const events = ['click', 'touchstart', 'keydown'];
      events.forEach(event => {
        document.addEventListener(event, resumeOnInteraction, { once: true, passive: true });
      });
      
      return () => {
        events.forEach(event => {
          document.removeEventListener(event, resumeOnInteraction);
        });
      };
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const analyzeAmplitude = useCallback(() => {
    if (!analyserRef.current || !onAmplitudeUpdate) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate RMS (Root Mean Square) for better amplitude detection
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sumSquares += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);
    
    // Also get time domain data for better speech detection
    const timeDataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(timeDataArray);
    
    // Calculate peak amplitude from time domain
    let peak = 0;
    for (let i = 0; i < timeDataArray.length; i++) {
      const amplitude = Math.abs(timeDataArray[i] - 128) / 128;
      if (amplitude > peak) peak = amplitude;
    }
    
    // Combine RMS and peak for smoother, more accurate lip sync
    const normalizedAmplitude = Math.min(1, (rms / 255) * 0.6 + peak * 0.4);

    onAmplitudeUpdate(normalizedAmplitude);

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(analyzeAmplitude);
    }
  }, [isPlaying, onAmplitudeUpdate]);

  /**
   * Play MP3 via HTMLAudioElement when Web Audio decode fails (Safari / codec quirks).
   * Lip sync analyser is skipped in this path.
   */
  const playAudioHtmlFallback = useCallback(
    async (audioBlob: Blob): Promise<void> => {
      if (htmlAudioRef.current) {
        try {
          htmlAudioRef.current.pause();
          htmlAudioRef.current.src = '';
        } catch {
          /* ok */
        }
        htmlAudioRef.current = null;
      }
      if (htmlAudioUrlRef.current) {
        URL.revokeObjectURL(htmlAudioUrlRef.current);
        htmlAudioUrlRef.current = null;
      }

      const url = URL.createObjectURL(audioBlob);
      htmlAudioUrlRef.current = url;
      const audio = new Audio();
      audio.src = url;
      audio.volume = isMuted ? 0 : 1;
      audio.setAttribute('playsinline', 'true');
      htmlAudioRef.current = audio;

      return new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          if (htmlAudioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            htmlAudioUrlRef.current = null;
          }
          if (htmlAudioRef.current === audio) {
            htmlAudioRef.current = null;
          }
        };
        audio.onended = () => {
          cleanup();
          setIsPlaying(false);
          if (onAmplitudeUpdate) onAmplitudeUpdate(0);
          resolve();
        };
        audio.onerror = () => {
          cleanup();
          setIsPlaying(false);
          if (onAmplitudeUpdate) onAmplitudeUpdate(0);
          reject(new Error('HTMLAudio playback failed'));
        };
        void audio
          .play()
          .then(() => {
            setIsPlaying(true);
            console.log('▶️ HTMLAudio playback started (fallback)');
          })
          .catch((e) => {
            cleanup();
            reject(e);
          });
      });
    },
    [isMuted, onAmplitudeUpdate]
  );

  /**
   * Plays one audio blob. Resolves when playback finishes (onended).
   * Callers that need multiple phrases in sequence should await each call or use a queue.
   */
  const playAudio = useCallback(async (audioBlob: Blob): Promise<void> => {
    if (!audioBlob || audioBlob.size < 32) {
      throw new Error('Invalid or empty audio blob');
    }

    const t = audioBlob.type || '';
    if (t.includes('json') || t.includes('text')) {
      const errText = await audioBlob.text();
      throw new Error(`TTS returned non-audio (${t}): ${errText.slice(0, 200)}`);
    }

    if (!audioContextRef.current || !analyserRef.current) {
      console.error('❌ AudioContext not initialized, initializing now...');
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 512;
        analyserRef.current.smoothingTimeConstant = 0.8;
        console.log('✅ AudioContext initialized on the fly');
      } catch (error) {
        console.error('❌ Failed to initialize AudioContext:', error);
        return playAudioHtmlFallback(audioBlob);
      }
    }

    const ctx = audioContextRef.current;
    const analyser = analyserRef.current;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        console.log('✅ AudioContext resumed, state:', ctx.state);
      } catch (resumeError) {
        console.error('❌ Failed to resume AudioContext:', resumeError);
      }
    }

    console.log('🎵 Decoding audio buffer, blob size:', audioBlob.size, 'bytes, type:', t || 'unknown');

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await audioBlob.arrayBuffer();
    } catch (e) {
      console.error('❌ Failed to read blob:', e);
      return playAudioHtmlFallback(audioBlob);
    }

    let audioBuffer: AudioBuffer;
    try {
      const copy = arrayBuffer.slice(0);
      audioBuffer = await ctx.decodeAudioData(copy);
    } catch (decodeErr) {
      console.warn('⚠️ decodeAudioData failed; using HTMLAudio fallback:', decodeErr);
      return playAudioHtmlFallback(audioBlob);
    }

    console.log('✅ Audio buffer decoded, duration:', audioBuffer.duration.toFixed(2), 'seconds');

    return await new Promise<void>((resolve, reject) => {
      try {
        if (sourceRef.current) {
          try {
            sourceRef.current.stop();
            sourceRef.current.disconnect();
          } catch {
            /* already stopped */
          }
          sourceRef.current = null;
        }

        try {
          analyser.disconnect();
        } catch {
          /* ok */
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);

        const gainNode = ctx.createGain();
        gainNode.gain.value = isMuted ? 0 : 1;
        analyser.connect(gainNode);
        gainNode.connect(ctx.destination);

        (source as any).gainNode = gainNode;

        source.onended = () => {
          console.log('✅ Audio playback completed');
          setIsPlaying(false);
          sourceRef.current = null;
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          if (onAmplitudeUpdate) {
            onAmplitudeUpdate(0);
          }
          resolve();
        };

        sourceRef.current = source;
        setIsPlaying(true);
        source.start(0);
        console.log('▶️ Audio playback started');

        if (onAmplitudeUpdate) {
          analyzeAmplitude();
        }
      } catch (error) {
        console.error('❌ Error starting playback:', error);
        setIsPlaying(false);
        if (onAmplitudeUpdate) {
          onAmplitudeUpdate(0);
        }
        reject(error);
      }
    });
  }, [isMuted, analyzeAmplitude, onAmplitudeUpdate, playAudioHtmlFallback]);

  const playAudioFromUrl = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await playAudio(blob);
    } catch (error) {
      console.error('Error fetching audio:', error);
    }
  }, [playAudio]);

  const stopAudio = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {
        // Ignore errors
      }
      sourceRef.current = null;
    }
    if (htmlAudioRef.current) {
      try {
        htmlAudioRef.current.pause();
        htmlAudioRef.current.src = '';
      } catch {
        /* ok */
      }
      htmlAudioRef.current = null;
    }
    if (htmlAudioUrlRef.current) {
      URL.revokeObjectURL(htmlAudioUrlRef.current);
      htmlAudioUrlRef.current = null;
    }
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (onAmplitudeUpdate) {
      onAmplitudeUpdate(0);
    }
  }, [onAmplitudeUpdate]);

  /**
   * Stops playback with a short gain fade (barge-in), then releases the source.
   */
  const stopAudioWithFade = useCallback(
    async (durationMs = 150): Promise<void> => {
      if (htmlAudioRef.current) {
        stopAudio();
        return;
      }
      const src = sourceRef.current;
      const ctx = audioContextRef.current;
      if (!src || !ctx) {
        setIsPlaying(false);
        if (onAmplitudeUpdate) onAmplitudeUpdate(0);
        return;
      }

      const gainNode = (src as unknown as { gainNode?: GainNode }).gainNode;
      if (!gainNode) {
        stopAudio();
        return;
      }

      const now = ctx.currentTime;
      const g = gainNode.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + durationMs / 1000);

      await new Promise<void>((resolve) => {
        window.setTimeout(() => {
          try {
            src.stop();
          } catch {
            /* already stopped */
          }
          sourceRef.current = null;
          setIsPlaying(false);
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          if (onAmplitudeUpdate) {
            onAmplitudeUpdate(0);
          }
          resolve();
        }, durationMs + 30);
      });
    },
    [onAmplitudeUpdate, stopAudio]
  );

  const toggleMute = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) {
      console.warn('Cannot toggle mute: AudioContext not initialized');
      return;
    }

    setIsMuted((prev) => {
      const newMuted = !prev;
      console.log(newMuted ? '🔇 Muting audio' : '🔊 Unmuting audio');
      
      // Update gain node if audio is currently playing
      if (sourceRef.current && (sourceRef.current as any).gainNode) {
        const gainNode = (sourceRef.current as any).gainNode;
        gainNode.gain.value = newMuted ? 0 : 1;
        console.log(`✅ Gain node updated: volume = ${gainNode.gain.value}`);
      }
      
      return newMuted;
    });
  }, []);

  return {
    isPlaying,
    isMuted,
    playAudio,
    playAudioFromUrl,
    stopAudio,
    stopAudioWithFade,
    toggleMute,
  };
}
