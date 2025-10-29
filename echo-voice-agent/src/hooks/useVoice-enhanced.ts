import { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceState } from '../types';
import { supabase } from '../lib/supabase';

export const useVoice = () => {
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    isSpeaking: false,
    isProcessing: false
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onTranscriptRef = useRef<((text: string) => void) | null>(null);
  
  // Deepgram WebSocket state
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptBufferRef = useRef<string>('');
  const sessionIdRef = useRef<string>('');

  const isSupported = true;

  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const connectDeepgram = useCallback(async () => {
    try {
      const response = await fetch(
        `https://bvwcxyjpxkaxirxuiqzp.supabase.co/functions/v1/deepgram-websocket-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const { wsUrl, token } = await response.json();
      if (!wsUrl || !token) {
        throw new Error('Deepgram credentials missing from response');
      }
      const ws = new WebSocket(wsUrl, ['token', token]);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Deepgram WebSocket connected');
      };

      ws.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          
          if (data.channel?.alternatives?.[0]?.transcript) {
            const transcript = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final || false;
            
            if (transcript.trim() && isFinal) {
              transcriptBufferRef.current += (transcriptBufferRef.current ? ' ' : '') + transcript;
            }
          }
        } catch (error) {
          console.error('Error parsing Deepgram response:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setVoiceState(prev => ({ ...prev, error: 'Connection error' }));
      };

      ws.onclose = () => {
        console.log('Deepgram WebSocket closed');
      };
    } catch (error) {
      console.error('Error connecting to Deepgram:', error);
      setVoiceState(prev => ({ ...prev, error: 'Failed to connect' }));
    }
  }, []);

  const storeAudioRecording = async () => {
    try {
      if (audioChunksRef.current.length === 0) return;

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const fileName = `user_${sessionIdRef.current}_${Date.now()}.webm`;

      const { error } = await supabase
        .storage
        .from('audio-recordings')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false,
        });

      if (error) {
        console.error('Error storing audio:', error);
      } else {
        console.log('Audio stored successfully:', fileName);
      }
    } catch (error) {
      console.error('Error in storeAudioRecording:', error);
    }
  };

  const startListening = useCallback(async (onTranscript: (text: string) => void) => {
    onTranscriptRef.current = onTranscript;
    transcriptBufferRef.current = '';
    audioChunksRef.current = [];
    sessionIdRef.current = `session-${Date.now()}`;
    
    try {
      await connectDeepgram();
      await new Promise(resolve => setTimeout(resolve, 500));

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await storeAudioRecording();
        stream.getTracks().forEach(track => track.stop());
      };

      audioRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const int16Data = new Int16Array(inputData.length);
          
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          wsRef.current.send(int16Data.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      setVoiceState(prev => ({ ...prev, isListening: true, error: undefined }));
    } catch (error) {
      console.error('Failed to start listening:', error);
      setVoiceState(prev => ({ ...prev, error: 'Failed to access microphone' }));
    }
  }, [connectDeepgram]);

  const stopListening = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop();
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
    }

    if (transcriptBufferRef.current && onTranscriptRef.current) {
      onTranscriptRef.current(transcriptBufferRef.current);
    }

    setVoiceState(prev => ({ ...prev, isListening: false }));
  }, []);

  const speak = useCallback(async (text: string) => {
    setVoiceState(prev => ({ ...prev, isSpeaking: true }));

    try {
      const ttsResponse = await fetch(
        `https://bvwcxyjpxkaxirxuiqzp.supabase.co/functions/v1/tts-professional`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            conversationId: sessionIdRef.current,
            voiceId: 'en-US-AriaNeural',
          }),
        }
      );

      if (ttsResponse.ok) {
        const audioBlob = await ttsResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setVoiceState(prev => ({ ...prev, isSpeaking: false }));
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          setVoiceState(prev => ({ ...prev, isSpeaking: false }));
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
      } else {
        throw new Error('TTS API failed');
      }
    } catch (error) {
      console.warn('Professional TTS failed, using fallback:', error);
      
      if (!window.speechSynthesis) {
        setVoiceState(prev => ({ ...prev, isSpeaking: false }));
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => 
        voice.name.includes('Female') || 
        voice.name.includes('Woman') ||
        voice.name.includes('Aria') ||
        voice.name.includes('Samantha')
      ) || voices.find(voice => voice.lang.startsWith('en'));
      
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      utterance.onend = () => {
        setVoiceState(prev => ({ ...prev, isSpeaking: false }));
      };

      utterance.onerror = () => {
        setVoiceState(prev => ({ ...prev, isSpeaking: false }));
      };

      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setVoiceState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  const setProcessing = useCallback((isProcessing: boolean) => {
    setVoiceState(prev => ({ ...prev, isProcessing }));
  }, []);

  return {
    voiceState,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    setProcessing
  };
};
