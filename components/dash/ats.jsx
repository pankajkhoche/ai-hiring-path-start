'use client';

import { useState, useRef } from 'react';
import { api, uploadFile } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSearch, CheckCircle2, XCircle, Wand2, Lock, Upload } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import AiLoader from '@/components/ui/ai-loader';

function ScoreGauge({ score }) {
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#38bdf8' : score >= 40 ? '#fbbf24' : '#f87171';
  return (
    <div className="relative h-40 w-40 grid place-items-center">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, hsl(240 6% 16%) 0deg)` }} />
      <div className="absolute inset-[10px] rounded-full bg-card grid place-items-center">
        <div className="text-center"><div className="text-4xl font-extrabold" style={{ color }}>{score}</div><div className="text-xs text-muted-foreground">/ 100</div></div>
      </div>
    </div>
  );
}

export default function ATS({ provider, access }) {
  const { t } = useI18n();
  const [resume, setResume] = useState('');
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [rewrite, setRewrite] = useState('');
  const [rewriting, setRewriting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const canRewrite = ['professional', 'premium'].includes(access?.tier);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const d = await uploadFile('/ai/resume/extract', file);
      setResume(d.text);
      toast.success(t('dashboard.ats.extractedToast', { chars: d.chars, filename: d.filename }));
    } catch (err) { toast.error(err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function analyze() {
    if (resume.trim().length < 40) { toast.error(t('dashboard.ats.resumeTooShort')); return; }
    setLoading(true); setResult(null); setRewrite('');
    try {
      const data = await api('/ai/ats', { method: 'POST', body: { resume, jobDescription: jd, provider } });
      setResult(data);
      toast.success(t('dashboard.ats.analysisCompleteToast', { score: data.overallScore }));
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }

  async function doRewrite() {
    setRewriting(true);
    try { const d = await api('/ai/resume/rewrite', { method: 'POST', body: { resume, targetRole: jd?.slice(0, 80), provider } }); setRewrite(d.rewritten); toast.success(t('dashboard.ats.rewriteReadyToast')); }
    catch (e) { toast.error(e.message); } finally { setRewriting(false); }
  }

  const sec = result?.sectionScores || {};

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2"><FileSearch className="h-5 w-5 text-primary" /><h3 className="font-semibold">{t('dashboard.ats.title')}</h3></div>
        <div><label className="text-sm text-muted-foreground">{t('dashboard.ats.resumeLabel')}</label>
          <div className="flex items-center gap-2 mt-1 mb-2">
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={onFile} className="hidden" />
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('dashboard.ats.extracting')}</> : <><Upload className="h-4 w-4 mr-2" /> {t('dashboard.ats.uploadButton')}</>}</Button>
            <span className="text-xs text-muted-foreground">{t('dashboard.ats.orPasteBelow')}</span>
          </div>
          <Textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={10} placeholder={t('dashboard.ats.resumePlaceholder')} className="font-mono text-xs" /></div>
        <div><label className="text-sm text-muted-foreground">{t('dashboard.ats.jdLabel')}</label><Textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={5} placeholder={t('dashboard.ats.jdPlaceholder')} className="mt-1" /></div>
        <Button onClick={analyze} disabled={loading} className="w-full">{loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('dashboard.ats.analyzing')}</> : t('dashboard.ats.analyzeButton')}</Button>
      </div>

      <div className="space-y-6">
        {!result && !loading && <div className="glass rounded-2xl p-10 grid place-items-center text-center h-full min-h-[300px]"><div><FileSearch className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{t('dashboard.ats.emptyState')}</p></div></div>}
        {loading && <div className="glass rounded-2xl min-h-[300px] flex items-center justify-center"><AiLoader label={t('dashboard.ats.analyzing')} /></div>}
        {result && (
          <>
            <div className="glass rounded-2xl p-6 flex items-center gap-6">
              <ScoreGauge score={result.overallScore} />
              <div className="flex-1"><h3 className="font-semibold text-lg">{t('dashboard.ats.matchTitle')}</h3><p className="text-sm text-muted-foreground mt-1">{result.summary}</p><Badge variant="outline" className="mt-3">{t('dashboard.ats.matchRate', { rate: result.matchRate })}</Badge></div>
            </div>
            <div className="glass rounded-2xl p-6">
              <h4 className="font-medium mb-3">{t('dashboard.ats.sectionScores')}</h4>
              <div className="space-y-3">{Object.entries(sec).map(([k, v]) => (<div key={k}><div className="flex justify-between text-sm mb-1"><span className="capitalize text-muted-foreground">{k}</span><span>{v}</span></div><div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${v}%` }} /></div></div>))}</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-5"><h4 className="font-medium text-sm mb-3 text-emerald-400">{t('dashboard.ats.matchedSkills')}</h4><div className="flex flex-wrap gap-2">{(result.matchedSkills || []).map((s) => <Badge key={s} variant="outline" className="border-emerald-500/40 text-emerald-300">{s}</Badge>)}</div></div>
              <div className="glass rounded-2xl p-5"><h4 className="font-medium text-sm mb-3 text-rose-400">{t('dashboard.ats.missingSkills')}</h4><div className="flex flex-wrap gap-2">{(result.missingSkills || []).map((s) => <Badge key={s} variant="outline" className="border-rose-500/40 text-rose-300">{s}</Badge>)}</div></div>
            </div>
            <div className="glass rounded-2xl p-6 space-y-4">
              <div><h4 className="font-medium text-sm mb-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> {t('dashboard.ats.strengths')}</h4><ul className="space-y-1 text-sm text-muted-foreground">{(result.strengths || []).map((s, i) => <li key={i}>• {s}</li>)}</ul></div>
              <div><h4 className="font-medium text-sm mb-2 flex items-center gap-2"><XCircle className="h-4 w-4 text-amber-400" /> {t('dashboard.ats.improvements')}</h4><ul className="space-y-1 text-sm text-muted-foreground">{(result.improvements || []).map((s, i) => <li key={i}>• {s}</li>)}</ul></div>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3"><h4 className="font-medium flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> {t('dashboard.ats.aiRewrite')}</h4>{!canRewrite && <Badge variant="outline" className="border-amber-500/40 text-amber-300"><Lock className="h-3 w-3 mr-1" /> {t('dashboard.ats.proBadge')}</Badge>}</div>
              {canRewrite ? (<>
                <Button size="sm" onClick={doRewrite} disabled={rewriting} variant="outline">{rewriting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('dashboard.ats.rewriteButton')}</Button>
                {rewrite && <Textarea readOnly value={rewrite} rows={12} className="mt-4 font-mono text-xs" />}
              </>) : <p className="text-sm text-muted-foreground">{t('dashboard.ats.upgradeNotice')}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
