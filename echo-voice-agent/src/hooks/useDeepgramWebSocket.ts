import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface DeepgramWebSocketOptions {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (error: Error) => void;
  onConnectionChange: (connected: boolean) => void;
}

export default function useDeepgramWebSocket({
  onTranscript,
  onError,
  onConnectionChange,
}: DeepgramWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const connectWebSocket = useCallback(async () => {
    try {
      console.log('Connecting to Deepgram WebSocket...');
      
      // Get WebSocket URL from edge function using Supabase client
      const { data, error } = await supabase.functions.invoke('deepgram-websocket-url');

      if (error) {
        console.error('Error calling edge function:', error);
        throw new Error(`Edge function error: ${error.message}`);
      }

      if (!data?.wsUrl || !data?.token) {
        console.error('No WebSocket URL/token received:', data);
        throw new Error('No WebSocket credentials received from server');
      }

      console.log('WebSocket URL received from server');

      // Create WebSocket connection
      const ws = new WebSocket(data.wsUrl, ['token', data.token]);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Deepgram WebSocket connected');
        setIsConnected(true);
        onConnectionChange(true);
      };

      ws.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          
          if (data.channel?.alternatives?.[0]?.transcript) {
            const transcript = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final || false;
            
            if (transcript.trim()) {
              onTranscript(transcript, isFinal);
            }
          }
        } catch (error) {
          console.error('Error parsing Deepgram response:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        console.log('Deepgram WebSocket closed');
        setIsConnected(false);
        onConnectionChange(false);
      };
    } catch (error) {
      console.error('Error connecting to Deepgram:', error);
      onError(error as Error);
    }
  }, [onTranscript, onError, onConnectionChange]);

  const startRecording = useCallback(async () => {
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await connectWebSocket();
        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Create processor for audio data
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert float32 to int16
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Send to Deepgram
          wsRef.current.send(int16Data.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      onError(error as Error);
    }
  }, [connectWebSocket, onError]);

  const stopRecording = useCallback(() => {
    // Stop processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Send close frame to Deepgram
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
    }

    setIsRecording(false);
  }, []);

  const disconnect = useCallback(() => {
    stopRecording();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isRecording,
    startRecording,
    stopRecording,
    disconnect,
  };
}
