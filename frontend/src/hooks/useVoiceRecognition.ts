import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVoiceRecognitionOptions {
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
}

export function useVoiceRecognition({
  onResult,
  onError,
  continuous = true,
  interimResults = true,
}: UseVoiceRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (onError) {
        onError('Speech recognition is not supported in this browser');
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      if (final) {
        onResult(final.trim());
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (onError) {
        onError(event.error);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [onResult, onError, continuous, interimResults]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting speech recognition:', err);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    isSupported: recognitionRef.current !== null,
  };
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
