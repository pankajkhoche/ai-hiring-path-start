'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProctorCamera from '@/components/dash/proctor-camera';
import { Loader2, MessageSquareText, Clock, RotateCcw, Mic, MicOff, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import AiLoader from '@/components/ui/ai-loader';

function fmt(s) { const m = Math.floor(s / 60); const r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; }

export default function Communication() {
  const { t } = useI18n();
  const [stage, setStage] = useState('setup'); // setup | mcq | passages | done
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [mcqAnswers, setMcqAnswers] = useState([]);
  const [mcqTimeLeft, setMcqTimeLeft] = useState(0);
  const [passageIdx, setPassageIdx] = useState(0);
  const [passageResults, setPassageResults] = useState([]);
  const [recording, setRecording] = useState(false);
  const [passageTimeLeft, setPassageTimeLeft] = useState(0);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [proctorSummary, setProctorSummary] = useState(null);
  const mcqTimerRef = useRef(null);
  const passageTimerRef = useRef(null);
  const recRef = useRef(null);
  const transcriptRef = useRef('');
  const startedAtRef = useRef(0);
  const mcqSubmittedRef = useRef(false);
  const passageStoppedRef = useRef(false);

  useEffect(() => () => { clearInterval(mcqTimerRef.current); clearInterval(passageTimerRef.current); try { recRef.current?.stop(); } catch {} }, []);

  async function start() {
    setLoading(true);
    try {
      const d = await api('/assessments/start', { method: 'POST', body: { category: 'communication' } });
      setData(d);
      setMcqAnswers(new Array(d.questions.length).fill(null));
      setMcqTimeLeft(d.mcq_time_limit_seconds);
      mcqSubmittedRef.current = false;
      setStage('mcq');
      mcqTimerRef.current = setInterval(() => {
        setMcqTimeLeft((tm) => { if (tm <= 1) { clearInterval(mcqTimerRef.current); finishMcq(); return 0; } return tm - 1; });
      }, 1000);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }

  function select(qi, oi) { setMcqAnswers((a) => a.map((v, i) => (i === qi ? oi : v))); }

  function finishMcq() {
    if (mcqSubmittedRef.current) return;
    mcqSubmittedRef.current = true;
    clearInterval(mcqTimerRef.current);
    setPassageIdx(0);
    setPassageResults([]);
    setStage('passages');
  }

  function startRecording() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { toast.error(t('dashboard.communication.missingFieldsToast')); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    transcriptRef.current = '';
    rec.onresult = (e) => {
      let finalT = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) finalT += e.results[i][0].transcript + ' ';
      if (finalT) transcriptRef.current += finalT;
    };
    rec.onerror = () => setRecording(false);
    recRef.current = rec;
    passageStoppedRef.current = false;
    startedAtRef.current = Date.now();
    rec.start();
    setRecording(true);
    const passage = data.passages[passageIdx];
    setPassageTimeLeft(data.passage_time_limit_seconds);
    passageTimerRef.current = setInterval(() => {
      setPassageTimeLeft((tm) => { if (tm <= 1) { clearInterval(passageTimerRef.current); stopRecording(passage); return 0; } return tm - 1; });
    }, 1000);
  }

  async function stopRecording(passage) {
    if (passageStoppedRef.current) return;
    passageStoppedRef.current = true;
    clearInterval(passageTimerRef.current);
    try { recRef.current?.stop(); } catch {}
    setRecording(false);
    const elapsedMin = Math.max((Date.now() - startedAtRef.current) / 60000, 0.1);
    const transcript = transcriptRef.current.trim();
    const wpm = Math.round(transcript.split(/\s+/).filter(Boolean).length / elapsedMin);
    setScoring(true);
    try {
      const scoreRes = await api('/ai/pronunciation/score', { method: 'POST', body: { referenceText: passage.text, transcript, wpm } });
      const entry = { passage_id: passage.id, transcript, wpm, score: scoreRes.score, matchPct: scoreRes.matchPct, feedback: scoreRes.feedback, tips: scoreRes.tips };
      setPassageResults((r) => [...r, entry]);
      if (passageIdx + 1 >= data.passages.length) {
        await finishAll([...passageResults, entry]);
      } else {
        setPassageIdx((i) => i + 1);
      }
    } catch (e) { toast.error(e.message); } finally { setScoring(false); }
  }

  async function finishAll(finalPassageResults) {
    setSubmitting(true);
    try {
      const r = await api('/assessments/submit', { method: 'POST', body: { assessment_id: data.assessment_id, mcq_answers: mcqAnswers, passage_results: finalPassageResults, proctoring: proctorSummary } });
      setResult(r);
      setStage('done');
    } catch (e) { toast.error(e.message); } finally { setSubmitting(false); }
  }

  if (stage === 'setup' && loading) return (
    <div className="max-w-xl mx-auto glass rounded-2xl min-h-[340px] flex items-center justify-center"><AiLoader label={t('dashboard.communication.preparing')} /></div>
  );

  if (stage === 'setup') return (
    <div className="max-w-xl mx-auto glass rounded-2xl p-8">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 grid place-items-center mb-4"><MessageSquareText className="h-7 w-7" /></div>
      <h2 className="text-2xl font-bold">{t('dashboard.communication.heading')}</h2>
      <p className="text-muted-foreground mt-1">{t('dashboard.communication.subtitle')}</p>
      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {t('dashboard.communication.cameraNotice')}</p>
      <Button onClick={start} disabled={loading} className="w-full mt-6">{t('dashboard.communication.startButton')}</Button>
    </div>
  );

  if (stage === 'done') return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="glass rounded-2xl p-8 text-center">
        <div className="text-5xl font-extrabold gradient-text">{result.score_pct}<span className="text-xl text-muted-foreground">%</span></div>
        <p className="text-muted-foreground mt-2">{t('dashboard.communication.grammarCorrectOf', { correct: result.mcq.correct, total: result.mcq.total, avg: result.avg_passage_score })}</p>
        <Button onClick={() => setStage('setup')} className="mt-6" variant="outline"><RotateCcw className="h-4 w-4 mr-2" /> {t('dashboard.communication.retake')}</Button>
      </div>
      {result.passage_results.map((p, i) => (
        <div key={i} className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between"><h4 className="font-medium text-sm">{t('dashboard.communication.passageN', { n: i + 1 })}</h4><Badge variant="outline">{p.score}/100 · {p.wpm} wpm</Badge></div>
          <p className="text-xs text-muted-foreground mt-2">{p.feedback}</p>
        </div>
      ))}
      {result.proctoring && (
        <div className="glass rounded-2xl p-5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">{t('dashboard.communication.attentivenessSignal')}</p>
          <p>{t('dashboard.communication.attentivenessDetail', { pct: result.proctoring.face_visible_pct ?? '—', multi: result.proctoring.multiple_faces_events, none: result.proctoring.no_face_events, flagged: result.proctoring.flagged_events ?? 0 })}</p>
          <p className="mt-1 italic">{result.proctoring.note}</p>
        </div>
      )}
    </div>
  );

  const activeCamera = stage === 'mcq' || stage === 'passages';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {activeCamera && <ProctorCamera active={activeCamera} onSummary={setProctorSummary} label={t('dashboard.communication.heading')} />}

      {stage === 'mcq' && (
        <>
          <div className="flex items-center justify-between sticky top-16 z-10 bg-background/90 backdrop-blur py-2">
            <Badge variant="outline">{mcqAnswers.filter((a) => a != null).length} / {data.questions.length} {t('dashboard.communication.answered')}</Badge>
            <Badge variant="outline" className={mcqTimeLeft < 60 ? 'border-rose-500/40 text-rose-300' : ''}><Clock className="h-3.5 w-3.5 mr-1.5" /> {fmt(mcqTimeLeft)}</Badge>
          </div>
          {data.questions.map((q, qi) => (
            <div key={q.id} className="glass rounded-2xl p-6">
              <p className="font-medium mb-3">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <button key={oi} onClick={() => select(qi, oi)} className={`w-full text-left rounded-lg border px-4 py-2.5 text-sm transition ${mcqAnswers[qi] === oi ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>{opt}</button>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={finishMcq} className="w-full">{t('dashboard.communication.continueToReadAloud')} <Mic className="h-4 w-4 ml-2" /></Button>
        </>
      )}

      {stage === 'passages' && (
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center justify-between mb-4"><Badge variant="outline">{t('dashboard.communication.passageOf', { current: passageIdx + 1, total: data.passages.length })}</Badge><Badge variant="outline" className={passageTimeLeft && passageTimeLeft < 20 ? 'border-rose-500/40 text-rose-300' : ''}><Clock className="h-3.5 w-3.5 mr-1.5" /> {fmt(passageTimeLeft)}</Badge></div>
          <p className="text-lg leading-relaxed">{data.passages[passageIdx].text}</p>
          <div className="mt-6 flex justify-center">
            {!recording ? (
              <Button onClick={startRecording} disabled={scoring} className="">{scoring ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('dashboard.communication.scoring')}</> : <><Mic className="h-4 w-4 mr-2" /> {t('dashboard.communication.startReading')}</>}</Button>
            ) : (
              <Button onClick={() => stopRecording(data.passages[passageIdx])} variant="outline" className="border-rose-500/50 text-rose-300"><MicOff className="h-4 w-4 mr-2" /> {t('dashboard.communication.stop')}</Button>
            )}
          </div>
          {recording && <p className="text-center text-xs text-rose-300 mt-3 flex items-center justify-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" /> {t('dashboard.communication.listening')}</p>}
        </div>
      )}

      {submitting && <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t('dashboard.communication.finalizing')}</div>}
    </div>
  );
}
