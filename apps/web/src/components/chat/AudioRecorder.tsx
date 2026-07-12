'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface AudioRecorderProps {
  onTranscript: (text: string) => void;
}

type RecorderState = 'idle' | 'recording' | 'processing';

export function AudioRecorder({ onTranscript }: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showError('Micrófono bloqueado o no disponible');
      return;
    }

    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
      ? 'audio/ogg;codecs=opus'
      : '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
      if (blob.size < 1000) {
        showError('Audio demasiado corto');
        setState('idle');
        return;
      }

      setState('processing');
      try {
        const formData = new FormData();
        formData.append('audio', blob, `audio.${mimeType.includes('ogg') ? 'ogg' : 'webm'}`);
        const { data } = await api.post<{ transcript: string }>('/chat/speech-to-text', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (data.transcript?.trim()) {
          onTranscript(data.transcript.trim());
        } else {
          showError('No se detectó voz');
        }
      } catch (err: any) {
        console.error('[AudioRecorder] Error STT:', err?.response?.status, err?.response?.data, err?.message);
        const msg = err?.response?.data?.message || err?.message || 'Error al transcribir el audio';
        showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      } finally {
        setState('idle');
      }
    };

    recorder.start();
    setState('recording');
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const handleClick = () => {
    if (state === 'recording') {
      stopRecording();
    } else if (state === 'idle') {
      startRecording();
    }
  };

  return (
    <div className="relative">
      {error && (
        <span className="absolute -top-9 left-1/2 -translate-x-1/2 text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 whitespace-nowrap z-10 shadow-sm">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'processing'}
        className={`p-2.5 rounded-lg transition-all active:scale-95 flex-shrink-0 ${
          state === 'recording'
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
            : state === 'processing'
            ? 'bg-blue-50 text-blue-400 border border-blue-200 cursor-wait'
            : error
            ? 'bg-red-50 text-red-400 border border-red-200'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
        }`}
        title={
          state === 'recording'
            ? 'Detener grabación'
            : state === 'processing'
            ? 'Transcribiendo...'
            : 'Grabar audio'
        }
      >
        {state === 'processing' ? (
          <Loader2 className="w-4.5 h-4.5 animate-spin" />
        ) : state === 'recording' ? (
          <MicOff className="w-4.5 h-4.5" />
        ) : (
          <Mic className="w-4.5 h-4.5" />
        )}
      </button>
    </div>
  );
}
