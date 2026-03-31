import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVoiceRecognitionOptions {
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
}

/** Web Speech API instance (types vary by TS/lib version) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

export function useVoiceRecognition({
  onResult,
  onError,
  continuous = true,
  interimResults = true,
}: UseVoiceRecognitionOptions) {
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<Recognition | null>(null);
  const sessionActiveRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => Recognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

    if (!SpeechRec) {
      onErrorRef.current?.('Speech recognition is not supported in this browser');
      setIsSupported(false);
      return;
    }

    const recognition: Recognition = new SpeechRec();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      if (!isMountedRef.current) return;
      setIsListening(true);
    };

    recognition.onresult = (event: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => {
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
        onResultRef.current(final.trim());
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (!isMountedRef.current) return;

      if (event.error === 'no-speech' && sessionActiveRef.current) {
        return;
      }
      if (event.error === 'aborted') {
        return;
      }

      setIsListening(false);
      sessionActiveRef.current = false;
      onErrorRef.current?.(event.error);
    };

    recognition.onend = () => {
      if (!isMountedRef.current) return;
      setIsListening(false);

      if (sessionActiveRef.current && recognitionRef.current) {
        requestAnimationFrame(() => {
          try {
            recognitionRef.current?.start();
          } catch {
            /* InvalidStateError: already started */
          }
        });
      }
    };

    recognitionRef.current = recognition;
    setIsSupported(true);

    return () => {
      sessionActiveRef.current = false;
      try {
        recognition.stop();
      } catch {
        /* not running */
      }
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single mount; config fixed at first paint
  }, []);

  const startListening = useCallback(() => {
    sessionActiveRef.current = true;
    try {
      recognitionRef.current?.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      sessionActiveRef.current = false;
    }
  }, []);

  const stopListening = useCallback(() => {
    sessionActiveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch (err) {
      console.error('Error stopping speech recognition:', err);
    }
  }, []);

  return {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    isSupported,
  };
}
