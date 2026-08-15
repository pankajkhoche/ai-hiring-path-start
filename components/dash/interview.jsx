'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Mic, MicOff, Volume2, ChevronRight, RotateCcw, Award, ShieldCheck } from 'lucide-react';
import ProctorCamera from '@/components/dash/proctor-camera';
import { useI18n } from '@/lib/i18n/context';
import Markdown from '@/components/ui/markdown';
import AiLoader from '@/components/ui/ai-loader';

export default function Interview() {
  const { t } = useI18n();
  const [stage, setStage] = useState('setup'); // setup | active | done
  const [role, setRole] = useState('Frontend Engineer');
  const [type, setType] = useState('technical');
  const [interview, setInterview] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [current, setCurrent] = useState(null);
  const [listening, setListening] = useState(false);
  const [proctorSummary, setProctorSummary] = useState(null);
  const recRef = useRef(null);
  const baseAnswerRef = useRef('');

  useEffect(() => () => { try { recRef.current?.stop(); } catch {} }, []);

  function speak(text) {
    if (typeof window === 'undefined' || !window.speechSynthesis) { toast.error(t('dashboard.interview.speechNotSupportedToast')); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  function toggleListen() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { toast.error(t('dashboard.interview.voiceNotSupportedToast')); return; }
    if (listening) { try { recRef.current?.stop(); } catch {} setListening(false); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    baseAnswerRef.current = answer ? answer + ' ' : '';
    rec.onresult = (e) => {
      let finalT = ''; let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalT += chunk + ' '; else interim += chunk;
      }
      if (finalT) baseAnswerRef.current += finalT;
      setAnswer((baseAnswerRef.current + interim).trim());
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => { setListening(false); };
    recRef.current = rec;
    try { rec.start(); setListening(true); toast.info(t('dashboard.interview.listeningToast')); } catch { setListening(false); }
  }

  async function start() {
    if (!role.trim()) { toast.error(t('dashboard.interview.enterRoleToast')); return; }
    setLoading(true);
    try {
      const data = await api('/ai/interview/generate', { method: 'POST', body: { role, type, count: 6 } });
      if (!data.questions?.length) throw new Error(t('dashboard.interview.noQuestionsError'));
      setInterview(data); setStage('active'); setIdx(0); setFeedbacks([]); setAnswer(''); setCurrent(null);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }

  async function submitAnswer() {
    if (!answer.trim()) { toast.error(t('dashboard.interview.typeOrSpeakToast')); return; }
    try { recRef.current?.stop(); } catch {} setListening(false);
    setEvaluating(true);
    try {
      const q = interview.questions[idx];
      const fb = await api('/ai/interview/evaluate', { method: 'POST', body: { role, question: q.question, answer, interviewId: interview.interviewId } });
      setCurrent(fb);
      setFeedbacks((f) => [...f, { q: q.question, ...fb }]);
    } catch (e) { toast.error(e.message); } finally { setEvaluating(false); }
  }

  async function next() {
    setAnswer(''); setCurrent(null);
    if (idx + 1 >= interview.questions.length) {
      const avg = Math.round(feedbacks.reduce((s, f) => s + (f.score || 0), 0) / feedbacks.length);
      await api('/ai/interview/complete', { method: 'POST', body: { interviewId: interview.interviewId, avgScore: avg, proctoring: proctorSummary } }).catch(() => {});
      setStage('done');
    } else setIdx((i) => i + 1);
  }

  const avgScore = feedbacks.length ? Math.round(feedbacks.reduce((s, f) => s + (f.score || 0), 0) / feedbacks.length) : 0;

  if (stage === 'setup' && loading) return (
    <div className="max-w-xl mx-auto glass rounded-2xl min-h-[380px] flex items-center justify-center"><AiLoader label={t('dashboard.interview.generatingQuestions')} /></div>
  );

  if (stage === 'setup') return (
    <div className="max-w-xl mx-auto glass rounded-2xl p-8">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 grid place-items-center mb-4"><Mic className="h-7 w-7" /></div>
      <h2 className="text-2xl font-bold">{t('dashboard.interview.heading')}</h2>
      <p className="text-muted-foreground mt-1">{t('dashboard.interview.subtitle')}</p>
      <div className="mt-6 space-y-4">
        <div><label className="text-sm text-muted-foreground">{t('dashboard.interview.roleLabel')}</label><Input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1" placeholder={t('dashboard.interview.rolePlaceholder')} /></div>
        <div><label className="text-sm text-muted-foreground">{t('dashboard.interview.typeLabel')}</label>
          <Select value={type} onValueChange={setType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="technical">{t('dashboard.interview.typeTechnical')}</SelectItem><SelectItem value="hr">{t('dashboard.interview.typeHr')}</SelectItem><SelectItem value="behavioral">{t('dashboard.interview.typeBehavioral')}</SelectItem></SelectContent></Select>
        </div>
        <Button onClick={start} disabled={loading} className="w-full">{t('dashboard.interview.startButton')}</Button>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {t('dashboard.interview.cameraNotice')}</p>
      </div>
    </div>
  );

  if (stage === 'done') return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="glass rounded-2xl p-8 text-center">
        <Award className="h-12 w-12 text-amber-400 mx-auto mb-3" />
        <h2 className="text-2xl font-bold">{t('dashboard.interview.completeHeading')}</h2>
        <div className="text-5xl font-extrabold gradient-text mt-4">{avgScore}<span className="text-xl text-muted-foreground">/100</span></div>
        <p className="text-muted-foreground mt-2">{t('dashboard.interview.averageScoreOf', { count: feedbacks.length, role })}</p>
        <Button onClick={() => setStage('setup')} className="mt-6" variant="outline"><RotateCcw className="h-4 w-4 mr-2" /> {t('dashboard.interview.newInterview')}</Button>
      </div>
      {proctorSummary && (
        <div className="glass rounded-2xl p-5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">{t('dashboard.interview.attentivenessSignal')}</p>
          <p>{t('dashboard.interview.attentivenessDetail', { pct: proctorSummary.face_visible_pct ?? '—', multi: proctorSummary.multiple_faces_events, none: proctorSummary.no_face_events, flagged: proctorSummary.flagged_events ?? 0 })}</p>
          <p className="mt-1 italic">{proctorSummary.note}</p>
        </div>
      )}
      {feedbacks.map((f, i) => (
        <div key={i} className="glass rounded-2xl p-6">
          <div className="flex justify-between items-start gap-4"><p className="font-medium text-sm">{f.q}</p><Badge variant="outline">{f.score}/100</Badge></div>
          <p className="text-xs text-muted-foreground mt-2"><span className="text-emerald-400">Tip:</span> {f.tip}</p>
        </div>
      ))}
    </div>
  );

  const q = interview.questions[idx];
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <ProctorCamera active={stage === 'active'} onSummary={setProctorSummary} label={t('dashboard.interview.heading')} />
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{t('dashboard.interview.questionOf', { current: idx + 1, total: interview.questions.length })}</span><Badge variant="outline">{role} • {type}</Badge></div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${((idx) / interview.questions.length) * 100}%` }} /></div>
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2"><Badge className="bg-primary">{q.difficulty}</Badge><span className="text-xs text-muted-foreground">{q.category}</span><button onClick={() => speak(q.question)} className="ml-auto text-muted-foreground hover:text-foreground" title={t('dashboard.interview.readAloud')}><Volume2 className="h-4 w-4" /></button></div>
        <h3 className="text-lg font-semibold">{q.question}</h3>
        {!current && <>
          <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} placeholder={t('dashboard.interview.answerPlaceholder')} className="mt-4" />
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button onClick={toggleListen} variant="outline" className={listening ? 'border-rose-500/50 text-rose-300' : ''}>{listening ? <><MicOff className="h-4 w-4 mr-2" /> {t('dashboard.interview.stopListening')}</> : <><Mic className="h-4 w-4 mr-2" /> {t('dashboard.interview.speakAnswer')}</>}</Button>
            {listening && <span className="flex items-center gap-1.5 text-xs text-rose-300"><span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" /> {t('dashboard.interview.listening')}</span>}
            <Button onClick={submitAnswer} disabled={evaluating} className="ml-auto">{evaluating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('dashboard.interview.evaluating')}</> : t('dashboard.interview.submitAnswer')}</Button>
          </div>
        </>}
      </div>
      {current && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between"><h4 className="font-semibold">{t('dashboard.interview.aiFeedback')}</h4><div className="text-2xl font-bold gradient-text">{current.score}/100</div></div>
          <div><h5 className="text-sm font-medium text-emerald-400 mb-1">{t('dashboard.interview.strengths')}</h5><ul className="text-sm text-muted-foreground space-y-1">{(current.strengths || []).map((s, i) => <li key={i}>• {s}</li>)}</ul></div>
          <div><h5 className="text-sm font-medium text-amber-400 mb-1">{t('dashboard.interview.gaps')}</h5><ul className="text-sm text-muted-foreground space-y-1">{(current.gaps || []).map((s, i) => <li key={i}>• {s}</li>)}</ul></div>
          <div><h5 className="text-sm font-medium text-primary mb-1">{t('dashboard.interview.modelAnswer')}</h5><Markdown content={current.betterAnswer || ''} className="text-muted-foreground" /></div>
          <Button onClick={next} className="w-full">{idx + 1 >= interview.questions.length ? t('dashboard.interview.finishSeeResults') : t('dashboard.interview.nextQuestion')} <ChevronRight className="h-4 w-4 ml-1" /></Button>
        </div>
      )}
    </div>
  );
}
