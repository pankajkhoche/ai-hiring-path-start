'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProctorCamera from '@/components/dash/proctor-camera';
import { Loader2, Code2, Clock, RotateCcw, Play, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import AiLoader from '@/components/ui/ai-loader';

const LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
];

function fmt(s) { const m = Math.floor(s / 60); const r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; }

function TestResults({ results, t }) {
  if (!results) return null;
  return (
    <div className="mt-4 space-y-2">
      {results.map((r, i) => (
        <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${r.passed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
          <div className="flex items-center gap-1.5 font-medium">{r.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-rose-400" />} {r.passed ? t('dashboard.technical.testPassed', { n: i + 1 }) : t('dashboard.technical.testFailed', { n: i + 1 })}</div>
          {!r.passed && (r.compile_error || r.stderr) && <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.compile_error || r.stderr}</pre>}
          {!r.passed && !r.compile_error && !r.stderr && <div className="mt-1 text-muted-foreground">{t('dashboard.technical.expected')} <code>{r.expected_output}</code> — {t('dashboard.technical.gotLabel')} <code>{r.actual_output || '(empty)'}</code></div>}
        </div>
      ))}
    </div>
  );
}

export default function Technical() {
  const { t } = useI18n();
  const [stage, setStage] = useState('setup'); // setup | s1 | s2 | s3 | done
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [proctorSummary, setProctorSummary] = useState(null);

  // Section 1 — MCQ
  const [mcqIdx, setMcqIdx] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState([]);
  const [qTimeLeft, setQTimeLeft] = useState(60);
  const qTimerRef = useRef(null);

  // Section 2 — coding
  const [codingIdx, setCodingIdx] = useState(0);
  const [codingAnswers, setCodingAnswers] = useState([]); // [{language, source_code}]
  const [codingResults, setCodingResults] = useState([]); // per-problem last run results
  const [running, setRunning] = useState(false);

  // Section 3 — SQL
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResults, setSqlResults] = useState(null);

  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => clearInterval(qTimerRef.current), []);

  async function start() {
    setLoading(true);
    try {
      const d = await api('/assessments/start', { method: 'POST', body: { category: 'technical' } });
      setData(d);
      setMcqAnswers(new Array(d.mcq_questions.length).fill(null));
      setCodingAnswers(d.coding_questions.map(() => ({ language: 'python', source_code: '' })));
      setCodingResults(d.coding_questions.map(() => null));
      setMcqIdx(0);
      setStage('s1');
      armQuestionTimer();
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }

  function armQuestionTimer() {
    clearInterval(qTimerRef.current);
    setQTimeLeft(60);
    qTimerRef.current = setInterval(() => {
      setQTimeLeft((tm) => { if (tm <= 1) { clearInterval(qTimerRef.current); advanceMcq(); return 0; } return tm - 1; });
    }, 1000);
  }

  function selectMcq(oi) { setMcqAnswers((a) => a.map((v, i) => (i === mcqIdx ? oi : v))); }

  function advanceMcq() {
    if (mcqIdx + 1 >= data.mcq_questions.length) {
      clearInterval(qTimerRef.current);
      setStage('s2');
    } else {
      setMcqIdx((i) => i + 1);
      armQuestionTimer();
    }
  }

  function updateCoding(field, value) {
    setCodingAnswers((arr) => arr.map((a, i) => (i === codingIdx ? { ...a, [field]: value } : a)));
  }

  async function runSample() {
    setRunning(true);
    try {
      const ans = codingAnswers[codingIdx];
      const r = await api('/assessments/run-code', { method: 'POST', body: { assessment_id: data.assessment_id, section: 'coding', question_index: codingIdx, language: ans.language, source_code: ans.source_code } });
      setCodingResults((arr) => arr.map((v, i) => (i === codingIdx ? r.results : v)));
    } catch (e) { toast.error(e.message); } finally { setRunning(false); }
  }

  async function runSqlSample() {
    setRunning(true);
    try {
      const r = await api('/assessments/run-code', { method: 'POST', body: { assessment_id: data.assessment_id, section: 'sql', source_code: sqlQuery } });
      setSqlResults(r.results);
    } catch (e) { toast.error(e.message); } finally { setRunning(false); }
  }

  async function finalSubmit() {
    setSubmitting(true);
    try {
      const r = await api('/assessments/submit', { method: 'POST', body: { assessment_id: data.assessment_id, mcq_answers: mcqAnswers, coding_answers: codingAnswers, sql_answer: { source_code: sqlQuery }, proctoring: proctorSummary } });
      setResult(r);
      setStage('done');
    } catch (e) { toast.error(e.message); } finally { setSubmitting(false); }
  }

  if (stage === 'setup' && loading) return (
    <div className="max-w-xl mx-auto glass rounded-2xl min-h-[340px] flex items-center justify-center"><AiLoader label={t('dashboard.technical.preparing')} /></div>
  );

  if (stage === 'setup') return (
    <div className="max-w-xl mx-auto glass rounded-2xl p-8">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-400 grid place-items-center mb-4"><Code2 className="h-7 w-7" /></div>
      <h2 className="text-2xl font-bold">{t('dashboard.technical.heading')}</h2>
      <p className="text-muted-foreground mt-1">{t('dashboard.technical.subtitle')}</p>
      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {t('dashboard.technical.cameraNotice')}</p>
      <Button onClick={start} disabled={loading} className="w-full mt-6">{t('dashboard.technical.startButton')}</Button>
    </div>
  );

  if (stage === 'done') return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="glass rounded-2xl p-8 text-center">
        <div className="text-5xl font-extrabold gradient-text">{result.score_pct}<span className="text-xl text-muted-foreground">%</span></div>
        <p className="text-muted-foreground mt-2">{t('dashboard.technical.scoreBreakdown', { mcq: result.sections.mcq.score_pct, coding: result.sections.coding.score_pct, sql: result.sections.sql.score_pct })}</p>
        <Button onClick={() => setStage('setup')} className="mt-6" variant="outline"><RotateCcw className="h-4 w-4 mr-2" /> {t('dashboard.technical.retake')}</Button>
      </div>
      {result.proctoring && (
        <div className="glass rounded-2xl p-5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">{t('dashboard.technical.attentivenessSignal')}</p>
          <p>{t('dashboard.technical.attentivenessDetail', { pct: result.proctoring.face_visible_pct ?? '—', multi: result.proctoring.multiple_faces_events, none: result.proctoring.no_face_events, flagged: result.proctoring.flagged_events ?? 0 })}</p>
          <p className="mt-1 italic">{result.proctoring.note}</p>
        </div>
      )}
    </div>
  );

  const activeCamera = stage === 's1' || stage === 's2' || stage === 's3';

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {activeCamera && <ProctorCamera active={activeCamera} onSummary={setProctorSummary} label={t('dashboard.technical.heading')} />}

      {stage === 's1' && (
        <div className="max-w-xl mx-auto space-y-4">
          <div className="flex items-center justify-between"><Badge variant="outline">{t('dashboard.technical.sectionMcq', { current: mcqIdx + 1, total: data.mcq_questions.length })}</Badge><Badge variant="outline" className={qTimeLeft < 15 ? 'border-rose-500/40 text-rose-300' : ''}><Clock className="h-3.5 w-3.5 mr-1.5" /> {qTimeLeft}s</Badge></div>
          <div className="glass rounded-2xl p-6">
            <p className="font-medium mb-3">{data.mcq_questions[mcqIdx].question}</p>
            <div className="space-y-2">
              {data.mcq_questions[mcqIdx].options.map((opt, oi) => (
                <button key={oi} onClick={() => selectMcq(oi)} className={`w-full text-left rounded-lg border px-4 py-2.5 text-sm transition ${mcqAnswers[mcqIdx] === oi ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <Button onClick={advanceMcq} className="w-full">{mcqIdx + 1 >= data.mcq_questions.length ? t('dashboard.technical.continueToCoding') : t('dashboard.technical.nextQuestion')}</Button>
        </div>
      )}

      {stage === 's2' && (
        <div className="space-y-4">
          <Badge variant="outline">{t('dashboard.technical.sectionCoding', { current: codingIdx + 1, total: data.coding_questions.length })}</Badge>
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold text-lg">{data.coding_questions[codingIdx].title}</h3>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{data.coding_questions[codingIdx].description}</p>
            {data.coding_questions[codingIdx].constraints && <p className="text-xs text-muted-foreground mt-2">{t('dashboard.technical.constraints', { text: data.coding_questions[codingIdx].constraints })}</p>}
            <div className="mt-3 space-y-1.5">{data.coding_questions[codingIdx].sample_test_cases.map((tc, i) => (
              <div key={i} className="text-xs bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground">{t('dashboard.technical.input')}</span> <code>{tc.input || '(none)'}</code> <span className="text-muted-foreground ml-2">{t('dashboard.technical.expected')}</span> <code>{tc.expected_output}</code></div>
            ))}</div>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <Select value={codingAnswers[codingIdx]?.language} onValueChange={(v) => updateCoding('language', v)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={runSample} disabled={running}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1.5" /> {t('dashboard.technical.runSampleTests')}</>}</Button>
            </div>
            <Textarea value={codingAnswers[codingIdx]?.source_code} onChange={(e) => updateCoding('source_code', e.target.value)} rows={12} placeholder={t('dashboard.technical.codePlaceholder')} className="font-mono text-sm" />
            <TestResults results={codingResults[codingIdx]} t={t} />
          </div>
          <Button onClick={() => codingIdx + 1 >= data.coding_questions.length ? setStage('s3') : setCodingIdx((i) => i + 1)} className="w-full">{codingIdx + 1 >= data.coding_questions.length ? t('dashboard.technical.continueToSql') : t('dashboard.technical.nextProblem')}</Button>
        </div>
      )}

      {stage === 's3' && (
        <div className="space-y-4">
          <Badge variant="outline">{t('dashboard.technical.sectionSql')}</Badge>
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold text-lg">{data.sql_question.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{data.sql_question.description}</p>
            <div className="mt-3 space-y-1.5">{data.sql_question.sample_test_cases.map((tc, i) => (
              <div key={i} className="text-xs bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground">{t('dashboard.technical.schemaData')}</span> <pre className="whitespace-pre-wrap">{tc.setup_sql}</pre><span className="text-muted-foreground">{t('dashboard.technical.expected')}</span> <code>{tc.expected_output}</code></div>
            ))}</div>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3"><span className="text-xs text-muted-foreground">{t('dashboard.technical.sqlHint')}</span><Button size="sm" variant="outline" onClick={runSqlSample} disabled={running}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1.5" /> {t('dashboard.technical.runSampleTests')}</>}</Button></div>
            <Textarea value={sqlQuery} onChange={(e) => setSqlQuery(e.target.value)} rows={6} placeholder={t('dashboard.technical.sqlPlaceholder')} className="font-mono text-sm" />
            <TestResults results={sqlResults} t={t} />
          </div>
          <Button onClick={finalSubmit} disabled={submitting} className="w-full">{submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('dashboard.technical.submitting')}</> : t('dashboard.technical.submitButton')}</Button>
        </div>
      )}
    </div>
  );
}
