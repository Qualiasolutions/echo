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
    return new Promise((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 3;
      
      const attemptConnection = () => {
        try {
          console.log('Connecting to Deepgram via Supabase...');
          
          supabase.functions.invoke('deepgram-websocket-url').then(({ data, error }) => {
            if (error) {
              console.error('Supabase function error:', error);
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`Retrying connection... (${retryCount}/${maxRetries})`);
                setTimeout(attemptConnection, 1000 * retryCount);
                return;
              }
              reject(new Error(`Edge function error: ${error.message}`));
              return;
            }

            if (!data?.wsUrl) {
              console.error('No WebSocket URL received:', data);
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(attemptConnection, 1000 * retryCount);
                return;
              }
              reject(new Error('No WebSocket URL received from server'));
              return;
            }

            console.log('WebSocket URL received:', data.wsUrl);
            const ws = new WebSocket(data.wsUrl);
            wsRef.current = ws;

            let connectionTimeout;
            
            // Set connection timeout
            connectionTimeout = setTimeout(() => {
              console.log('WebSocket connection timeout');
              ws.close();
              if (retryCount < maxRetries) {
                retryCount++;
                attemptConnection();
              } else {
                reject(new Error('WebSocket connection timeout'));
              }
            }, 10000);

            ws.onopen = () => {
              console.log('Deepgram WebSocket connected successfully');
              clearTimeout(connectionTimeout);
              
              // Check WebSocket readyState
              console.log('WebSocket readyState:', ws.readyState);
              
              // Wait a moment for Deepgram to acknowledge
              setTimeout(() => {
                console.log('WebSocket ready for audio input, readyState:', ws.readyState);
                resolve(ws);
              }, 1000);
            };

            ws.onmessage = (message) => {
              try {
                const responseData = JSON.parse(message.data);
                console.log('Deepgram response received:', responseData.type);
                
                // Check for connection acknowledgment from Deepgram
                if (responseData.type === 'RecognitionStarted' || responseData.type === 'Results') {
                  console.log('Deepgram acknowledged connection');
                }
                
                // Handle transcript results
                if (responseData.channel?.alternatives?.[0]?.transcript) {
                  const transcript = responseData.channel.alternatives[0].transcript;
                  const isFinal = responseData.is_final || false;
                  
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
              clearTimeout(connectionTimeout);
              
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`WebSocket error, retrying... (${retryCount}/${maxRetries})`);
                setTimeout(attemptConnection, 1000 * retryCount);
              } else {
                reject(new Error('WebSocket connection failed after retries'));
              }
            };

            ws.onclose = (event) => {
              console.log('Deepgram WebSocket closed:', event.code, event.reason);
              clearTimeout(connectionTimeout);
              
              if (event.code !== 1000 && retryCount < maxRetries) {
                retryCount++;
                console.log(`WebSocket closed unexpectedly, retrying... (${retryCount}/${maxRetries})`);
                setTimeout(attemptConnection, 1000 * retryCount);
              }
            };
          }).catch((error) => {
            console.error('Supabase function call failed:', error);
            reject(error);
          });
        } catch (error) {
          console.error('Error setting up WebSocket connection:', error);
          reject(error);
        }
      };

      attemptConnection();
    });
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

  const checkPermissions = useCallback(async () => {
    try {
      // Check if we have permission already
      const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      if (permissions.state === 'denied') {
        throw new Error('Microphone access permanently denied. Please enable in browser settings.');
      }
      
      return permissions.state === 'granted';
    } catch (error) {
      // permissions.query might not be supported, just return false
      return false;
    }
  }, []);

  const checkMicrophoneAvailability = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { available: false, message: 'Microphone access not supported in this browser.' };
      }

      if (!window.isSecureContext) {
        return { available: false, message: 'Microphone requires HTTPS (secure connection).' };
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      if (audioInputs.length === 0) {
        return { available: false, message: 'No microphone found. Please connect a microphone and try again.' };
      }

      return { available: true, message: 'Microphone detected.' };
    } catch (error) {
      return { available: false, message: 'Unable to check microphone availability.' };
    }
  }, []);

  const startListening = useCallback(async (onTranscript: (text: string) => void) => {
    onTranscriptRef.current = onTranscript;
    transcriptBufferRef.current = '';
    audioChunksRef.current = [];
    sessionIdRef.current = `session-${Date.now()}`;
    
    try {
      console.log('Starting voice recognition...');
      
      // Check permissions first
      const hasPermission = await checkPermissions();
      
      if (!hasPermission) {
        console.log('Requesting microphone permission...');
        // Request permission explicitly
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
        };
        
        // Use try-catch to handle permission denial gracefully
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (permError) {
          console.error('Permission error:', permError);
          throw permError;
        }
        
        // Clean up the stream immediately if we're just checking permissions
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Connect to Deepgram and wait for full acknowledgment
      console.log('Establishing WebSocket connection to Deepgram...');
      await connectDeepgram();
      
      // Wait longer for WebSocket to be completely ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Requesting microphone access for real...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      console.log('Microphone access granted, setting up audio processing...');
      streamRef.current = stream;

      console.log('Setting up audio processing pipeline...');
      
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

      console.log('Starting audio streaming to Deepgram...');
      processor.onaudioprocess = (e) => {
        // Only send audio if WebSocket is ready and connected
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16Data = new Int16Array(inputData.length);
            
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            wsRef.current.send(int16Data.buffer);
          } catch (error) {
            console.error('Error sending audio data:', error);
          }
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      // Wait for WebSocket to be fully ready before marking as listening
      const waitForReady = () => {
        return new Promise((resolve) => {
          const checkReady = () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              console.log('WebSocket ready for audio input');
              resolve(true);
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      };

      await waitForReady();

      setVoiceState(prev => ({ ...prev, isListening: true, error: undefined }));
      console.log('Voice recognition started successfully');
    } catch (error) {
      console.error('Failed to start listening:', error);
      let errorMessage = 'Failed to access microphone';
      
      if (error instanceof Error) {
        // Check for secure context
        if (!window.isSecureContext) {
          errorMessage = 'Voice recognition requires a secure connection (HTTPS). Please use a secure URL.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please check your microphone connection and browser permissions.';
        } else if (error.name === 'NotAllowedError') {
          errorMessage = 'Microphone access denied. Please click the microphone icon again to grant permissions.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Microphone is being used by another application. Please close other apps and try again.';
        } else if (error.message.includes('Permissions policy')) {
          errorMessage = 'Microphone access is blocked by the website. Please check your browser settings or try refreshing the page.';
        } else {
          errorMessage = `Voice recognition error: ${error.message}`;
        }
      }
      
      setVoiceState(prev => ({ ...prev, error: errorMessage }));
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
      console.log('Getting TTS response...');
      
      const { data, error } = await supabase.functions.invoke('tts-professional', {
        body: {
          text,
          conversationId: sessionIdRef.current,
          voiceId: 'English_Trustworth_Man', // Use male voice as specified
        }
      });

      if (error) {
        console.error('TTS function error:', error);
        throw new Error(`TTS error: ${error.message}`);
      }

      if (data?.success && data?.audioUrl) {
        console.log('Playing TTS audio...');
        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setVoiceState(prev => ({ ...prev, isSpeaking: false }));
        };

        audio.onerror = () => {
          console.error('Audio playback error');
          setVoiceState(prev => ({ ...prev, isSpeaking: false }));
          // Fallback to browser TTS
          speakWithBrowserTTS(text);
        };

        await audio.play();
      } else if (data?.useClientTTS) {
        console.log('Using browser TTS...');
        speakWithBrowserTTS(text);
      } else {
        throw new Error('No audio response received');
      }
    } catch (error) {
      console.warn('TTS failed, using browser fallback:', error);
      speakWithBrowserTTS(text);
    }
  }, []);

  const speakWithBrowserTTS = useCallback((text: string) => {
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
    const maleVoice = voices.find(voice => 
      voice.name.includes('Male') || 
      voice.name.includes('Man') ||
      voice.name.includes('David') ||
      voice.name.includes('Mark') ||
      voice.name.includes('Tom')
    ) || voices.find(voice => voice.lang.startsWith('en'));
    
    if (maleVoice) {
      utterance.voice = maleVoice;
    }

    utterance.onend = () => {
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
    };

    utterance.onerror = () => {
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
    };

    window.speechSynthesis.speak(utterance);
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
    setProcessing,
    checkMicrophoneAvailability
  };
};
