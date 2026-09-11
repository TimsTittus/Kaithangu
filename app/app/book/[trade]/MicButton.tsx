'use client';

import { LoaderCircle, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { messageFor, type Messages } from '@/components/api';
import { errorTextClass, mutedTextClass, secondaryButtonClass } from '@/components/ui';

const MAX_RECORDING_MS = 30_000;
// Opus at 24 kbit/s: 30 s ≈ 90 KB, well under the 1 MB /api/v1/stt limit.
const AUDIO_BITS_PER_SECOND = 24_000;
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg'];

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'MediaRecorder' in window &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

const noSubscription = () => () => {};

interface Strings {
  start: string;
  stop: string;
  listening: string;
  processing: string;
  failed: string;
  denied: string;
}

/**
 * Records up to 30 s with MediaRecorder, sends it to /api/v1/stt and hands
 * the transcript back. Renders nothing where recording is unsupported.
 */
export function MicButton({
  onTranscript,
  strings,
  errors,
}: {
  onTranscript: (text: string) => void;
  strings: Strings;
  errors: Messages;
}) {
  const supported = useSyncExternalStore(noSubscription, isSupported, () => false);
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (recorder.current?.state === 'recording') recorder.current.stop();
    },
    [],
  );

  async function upload(blob: Blob) {
    try {
      const response = await fetch('/api/v1/stt', {
        method: 'POST',
        headers: { 'content-type': blob.type },
        body: blob,
      });
      const json = (await response.json().catch(() => null)) as
        { data: { transcript: string } } | { error: { messageKey: string } } | null;
      if (response.ok && json !== null && 'data' in json && json.data.transcript !== '') {
        onTranscript(json.data.transcript);
        setMessage(null);
      } else {
        setMessage(
          json !== null && 'error' in json
            ? messageFor(errors, json.error.messageKey)
            : strings.failed,
        );
      }
    } catch {
      setMessage(messageFor(errors, 'common.offline'));
    } finally {
      setState('idle');
    }
  }

  async function start() {
    setMessage(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessage(strings.denied);
      return;
    }
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    if (mimeType === undefined) {
      stream.getTracks().forEach((track) => track.stop());
      setMessage(strings.failed);
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    rec.onstop = () => {
      window.clearTimeout(timer.current);
      stream.getTracks().forEach((track) => track.stop());
      setState('processing');
      void upload(new Blob(chunks, { type: mimeType }));
    };
    recorder.current = rec;
    rec.start();
    setState('recording');
    timer.current = window.setTimeout(() => {
      if (rec.state === 'recording') rec.stop();
    }, MAX_RECORDING_MS);
  }

  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => (state === 'recording' ? stop() : void start())}
        disabled={state === 'processing'}
        className={secondaryButtonClass}
        aria-pressed={state === 'recording'}
        data-testid="mic"
      >
        {state === 'recording' ? (
          <Square aria-hidden className="size-5 text-red-700" />
        ) : state === 'processing' ? (
          <LoaderCircle aria-hidden className="size-5 animate-spin" />
        ) : (
          <Mic aria-hidden className="size-5" />
        )}
        {state === 'recording' ? strings.stop : strings.start}
      </button>
      {state === 'recording' && (
        <p role="status" className={mutedTextClass}>
          {strings.listening}
        </p>
      )}
      {state === 'processing' && (
        <p role="status" className={mutedTextClass}>
          {strings.processing}
        </p>
      )}
      {message !== null && <p className={errorTextClass}>{message}</p>}
    </div>
  );
}
