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

  const playAudio = useCallback(async (audioBlob: Blob) => {
    if (!audioContextRef.current || !analyserRef.current) {
      console.error('❌ AudioContext not initialized, initializing now...');
      // Try to initialize on the fly
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 512;
        analyserRef.current.smoothingTimeConstant = 0.8;
        console.log('✅ AudioContext initialized on the fly');
      } catch (error) {
        console.error('❌ Failed to initialize AudioContext:', error);
        return;
      }
    }

    try {
      // Always try to resume AudioContext (browser autoplay policy)
      if (audioContextRef.current.state === 'suspended') {
        console.log('⏸️ AudioContext is suspended, attempting to resume...');
        try {
          const resumed = await audioContextRef.current.resume();
          console.log('✅ AudioContext resumed successfully, state:', audioContextRef.current.state);
        } catch (resumeError) {
          console.error('❌ Failed to resume AudioContext:', resumeError);
          // Don't return - try to play anyway, user might interact
          console.log('⚠️ Continuing despite suspended state - user interaction may be needed');
        }
      } else {
        console.log('✅ AudioContext is already running, state:', audioContextRef.current.state);
      }

      console.log('🎵 Decoding audio buffer, blob size:', audioBlob.size, 'bytes');
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      console.log('✅ Audio buffer decoded, duration:', audioBuffer.duration.toFixed(2), 'seconds');

      // Stop previous source if playing
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
          sourceRef.current.disconnect();
        } catch (e) {
          // Ignore errors when stopping
        }
      }

      // Disconnect analyser first to avoid conflicts
      try {
        analyserRef.current.disconnect();
      } catch (e) {
        // Ignore if already disconnected
      }

      // Create new source
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;

      // Connect source -> analyser -> gain -> destination
      source.connect(analyserRef.current);
      
      // Create gain node for volume control (mute/unmute)
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = isMuted ? 0 : 1; // Set volume based on mute state
      
      // Connect analyser -> gain -> destination
      analyserRef.current.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      console.log(isMuted ? '🔇 Audio connected but muted (volume = 0)' : '🔊 Audio connected and unmuted (volume = 1)');
      
      // Store gain node reference for mute toggle
      (source as any).gainNode = gainNode;

      source.onended = () => {
        console.log('✅ Audio playback completed');
        setIsPlaying(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (onAmplitudeUpdate) {
          onAmplitudeUpdate(0);
        }
      };

      source.onerror = (error) => {
        console.error('❌ Audio source error:', error);
        setIsPlaying(false);
        if (onAmplitudeUpdate) {
          onAmplitudeUpdate(0);
        }
      };

      sourceRef.current = source;
      setIsPlaying(true);
      source.start(0);
      console.log('▶️ Audio playback started');

      // Start amplitude analysis for lip sync
      if (onAmplitudeUpdate) {
        analyzeAmplitude();
      }
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      setIsPlaying(false);
      if (onAmplitudeUpdate) {
        onAmplitudeUpdate(0);
      }
    }
  }, [isMuted, analyzeAmplitude, onAmplitudeUpdate]);

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
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

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
    toggleMute,
  };
}
