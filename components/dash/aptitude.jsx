'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, Clock, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import AiLoader from '@/components/ui/ai-loader';

function fmt(s) { const m = Math.floor(s / 60); const r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; }

export default function Aptitude() {
  const { t } = useI18n();
  const [stage, setStage] = useState('setup'); // setup | active | done
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => () => clearInterval(timerRef.current), []);

  async function start() {
    setLoading(true);
    try {
      const d = await api('/assessments/start', { method: 'POST', body: { category: 'aptitude' } });
      setData(d);
      setAnswers(new Array(d.questions.length).fill(null));
      setTimeLeft(d.time_limit_seconds);
      submittedRef.current = false;
      setStage('active');
      timerRef.current = setInterval(() => {
        setTimeLeft((tm) => {
          if (tm <= 1) { clearInterval(timerRef.current); submit(true); return 0; }
          return tm - 1;
        });
      }, 1000);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }

  async function submit(auto) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    clearInterval(timerRef.current);
    setSubmitting(true);
    try {
      const r = await api('/assessments/submit', { method: 'POST', body: { assessment_id: data.assessment_id, answers } });
      setResult(r);
      setStage('done');
      if (auto) toast.info(t('dashboard.aptitude.autoSubmittedToast'));
    } catch (e) { toast.error(e.message); submittedRef.current = false; } finally { setSubmitting(false); }
  }

  function select(qi, oi) { setAnswers((a) => a.map((v, i) => (i === qi ? oi : v))); }

  if (stage === 'setup' && loading) return (
    <div className="max-w-xl mx-auto glass rounded-2xl min-h-[320px] flex items-center justify-center"><AiLoader label={t('dashboard.aptitude.generatingQuestions')} /></div>
  );

  if (stage === 'setup') return (
    <div className="max-w-xl mx-auto glass rounded-2xl p-8">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 grid place-items-center mb-4"><Brain className="h-7 w-7" /></div>
      <h2 className="text-2xl font-bold">{t('dashboard.aptitude.heading')}</h2>
      <p className="text-muted-foreground mt-1">{t('dashboard.aptitude.subtitle')}</p>
      <Button onClick={start} disabled={loading} className="w-full mt-6">{t('dashboard.aptitude.startButton')}</Button>
    </div>
  );

  if (stage === 'done') return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="glass rounded-2xl p-8 text-center">
        <div className="text-5xl font-extrabold gradient-text">{result.score_pct}<span className="text-xl text-muted-foreground">%</span></div>
        <p className="text-muted-foreground mt-2">{t('dashboard.aptitude.correctOf', { correct: result.mcq.correct, total: result.mcq.total })}</p>
        <Button onClick={() => setStage('setup')} className="mt-6" variant="outline"><RotateCcw className="h-4 w-4 mr-2" /> {t('dashboard.aptitude.retake')}</Button>
      </div>
      {result.mcq.per_question.map((q, i) => (
        <div key={i} className="glass rounded-2xl p-5 flex items-start gap-3">
          {q.is_correct ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />}
          <div><p className="text-sm font-medium">{q.question}</p>{!q.is_correct && <p className="text-xs text-muted-foreground mt-1">{t('dashboard.aptitude.correctAnswer', { n: q.correct_index + 1 })}</p>}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between sticky top-16 z-10 bg-background/90 backdrop-blur py-2">
        <Badge variant="outline">{answers.filter((a) => a != null).length} / {data.questions.length} {t('dashboard.aptitude.answered')}</Badge>
        <Badge variant="outline" className={timeLeft < 60 ? 'border-rose-500/40 text-rose-300' : ''}><Clock className="h-3.5 w-3.5 mr-1.5" /> {fmt(timeLeft)}</Badge>
      </div>
      {data.questions.map((q, qi) => (
        <div key={q.id} className="glass rounded-2xl p-6">
          <p className="font-medium mb-3">{qi + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <button key={oi} onClick={() => select(qi, oi)} className={`w-full text-left rounded-lg border px-4 py-2.5 text-sm transition ${answers[qi] === oi ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>{opt}</button>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={() => submit(false)} disabled={submitting} className="w-full">{submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('dashboard.aptitude.submitting')}</> : t('dashboard.aptitude.submitButton')}</Button>
    </div>
  );
}
