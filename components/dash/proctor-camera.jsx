'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';

// Lightweight, honest proctoring signal: a permission-gated live camera/mic preview plus
// client-side face-presence monitoring (via @mediapipe/tasks-vision, entirely in-browser --
// no frames are ever sent to a server). This produces attentiveness signals (face visible %,
// multiple-faces-detected events, no-face-detected events, mic/speaking activity) -- it is
// NOT a scientific "confidence" score or a definitive cheating verdict, and the UI says so.
//
// Usage: <ProctorCamera active={stage === 'active'} onSummary={(summary) => ...} />
// `onSummary` fires once, with the accumulated stats, when `active` transitions true -> false
// (or on unmount while still active).

const SAMPLE_INTERVAL_MS = 2000;
const SPEAKING_VOLUME_THRESHOLD = 0.02;
const WARN_AFTER_CONSECUTIVE = 3; // ~6s of sustained no-face/multi-face before flagging

export default function ProctorCamera({ active, onSummary, label = 'Proctoring' }) {
  const { t } = useI18n();
  const [permission, setPermission] = useState('idle'); // idle | requesting | granted | denied
  const [faceStatus, setFaceStatus] = useState('unknown'); // unknown | ok | multiple | none
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const intervalRef = useRef(null);
  const statsRef = useRef({ samples: 0, facePresent: 0, multiFace: 0, noFace: 0, speaking: 0, flagged: 0 });
  const wasActiveRef = useRef(false);
  const consecutiveBadRef = useRef({ kind: null, count: 0 });
  const warnedRef = useRef(false);

  async function enable() {
    setPermission('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: true });
      streamRef.current = stream;
      setPermission('granted');
      // The <video> element only mounts once permission flips to 'granted' and this
      // component re-renders, so attaching srcObject happens in the effect below --
      // videoRef.current would still be null here, before that render has happened.

      // Mic level analyser (rough "speaking" signal -- no audio is recorded or sent anywhere).
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      // Face detector -- loaded lazily, runs fully client-side.
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
        detectorRef.current = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite' },
          runningMode: 'VIDEO',
        });
      } catch (e) {
        console.error('Face detector failed to load:', e?.message);
      }
    } catch (e) {
      setPermission('denied');
    }
  }

  function sample() {
    // Face presence
    if (detectorRef.current && videoRef.current && videoRef.current.readyState >= 2) {
      try {
        const result = detectorRef.current.detectForVideo(videoRef.current, performance.now());
        const count = result?.detections?.length ?? 0;
        statsRef.current.samples++;
        if (count === 1) {
          statsRef.current.facePresent++; setFaceStatus('ok');
          consecutiveBadRef.current = { kind: null, count: 0 };
          warnedRef.current = false;
        } else {
          const kind = count > 1 ? 'multiple' : 'none';
          if (count > 1) statsRef.current.multiFace++; else statsRef.current.noFace++;
          setFaceStatus(kind);
          const c = consecutiveBadRef.current;
          consecutiveBadRef.current = kind === c.kind ? { kind, count: c.count + 1 } : { kind, count: 1 };
          if (consecutiveBadRef.current.count >= WARN_AFTER_CONSECUTIVE && !warnedRef.current) {
            warnedRef.current = true;
            statsRef.current.flagged++;
            toast.warning(kind === 'multiple' ? t('dashboard.proctor.warningMultipleFaces') : t('dashboard.proctor.warningNoFace'));
          }
        }
      } catch { /* detector not ready yet */ }
    }
    // Mic activity
    if (analyserRef.current) {
      const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      if (rms > SPEAKING_VOLUME_THRESHOLD) statsRef.current.speaking++;
    }
  }

  function teardown(emitSummary) {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    detectorRef.current = null;
    if (emitSummary && onSummary) {
      const s = statsRef.current;
      onSummary({
        samples: s.samples,
        face_visible_pct: s.samples ? Math.round((s.facePresent / s.samples) * 100) : null,
        multiple_faces_events: s.multiFace,
        no_face_events: s.noFace,
        speaking_pct: s.samples ? Math.round((s.speaking / s.samples) * 100) : null,
        flagged_events: s.flagged,
        note: t('dashboard.proctor.summaryNote'),
      });
    }
    statsRef.current = { samples: 0, facePresent: 0, multiFace: 0, noFace: 0, speaking: 0, flagged: 0 };
    consecutiveBadRef.current = { kind: null, count: 0 };
    warnedRef.current = false;
  }

  useEffect(() => {
    if (permission === 'granted' && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [permission]);

  useEffect(() => {
    if (active && permission === 'granted' && !intervalRef.current) {
      intervalRef.current = setInterval(sample, SAMPLE_INTERVAL_MS);
    }
    if (!active && wasActiveRef.current) {
      teardown(true);
      setFaceStatus('unknown');
    }
    wasActiveRef.current = active;
    return () => { if (!active) return; }; // real cleanup happens in unmount effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, permission]);

  useEffect(() => () => teardown(wasActiveRef.current), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (permission === 'idle' || permission === 'requesting') {
    return (
      <div className="glass rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldAlert className="h-4 w-4 text-amber-400" /> {t('dashboard.proctor.permissionNeeded', { label })}</div>
        <button onClick={enable} disabled={permission === 'requesting'} className="text-xs font-medium bg-primary text-primary-foreground rounded-lg px-3 py-1.5 shrink-0">
          {permission === 'requesting' ? t('dashboard.proctor.requesting') : t('dashboard.proctor.enableButton')}
        </button>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="glass rounded-xl p-4 flex items-center gap-2 text-sm text-rose-300"><CameraOff className="h-4 w-4" /> {t('dashboard.proctor.denied')}</div>
    );
  }

  const dotColor = faceStatus === 'ok' ? 'bg-emerald-500' : faceStatus === 'multiple' || faceStatus === 'none' ? 'bg-rose-500' : 'bg-muted-foreground';
  const statusText = faceStatus === 'ok' ? t('dashboard.proctor.faceDetected') : faceStatus === 'multiple' ? t('dashboard.proctor.multipleFaces') : faceStatus === 'none' ? t('dashboard.proctor.noFaceVisible') : t('dashboard.proctor.starting');

  return (
    <div className="fixed bottom-4 right-4 z-40 glass rounded-xl p-2 w-40 shadow-lg">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-28 object-cover rounded-lg bg-black" />
      <div className="flex items-center gap-1.5 mt-1.5 px-0.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <span className="text-[10px] text-muted-foreground truncate">{statusText}</span>
      </div>
    </div>
  );
}
