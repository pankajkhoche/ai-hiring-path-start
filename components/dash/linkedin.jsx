'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Linkedin, Copy, Sparkles, CheckCircle2, Info } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import Markdown from '@/components/ui/markdown';
import AiLoader from '@/components/ui/ai-loader';

export default function LinkedIn({ provider }) {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function optimize() {
    if (text.trim().length < 30) { toast.error(t('dashboard.linkedin.missingFieldsToast')); return; }
    setLoading(true); setResult(null);
    try {
      const d = await api('/ai/linkedin/optimize', { method: 'POST', body: { url, profileText: text, targetRole: role, provider } });
      setResult(d); toast.success(t('dashboard.linkedin.analyzedToast', { score: d.profileScore }));
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }
  function copy(txt) { navigator.clipboard?.writeText(txt); toast.success(t('dashboard.linkedin.copiedToast')); }

  const score = result?.profileScore ?? 0;
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#38bdf8' : score >= 40 ? '#fbbf24' : '#f87171';

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2"><Linkedin className="h-5 w-5 text-sky-400" /><h3 className="font-semibold">{t('dashboard.linkedin.title')}</h3></div>
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /> {t('dashboard.linkedin.fetchNotice')}</div>
        <div><label className="text-sm text-muted-foreground">{t('dashboard.linkedin.urlLabel')}</label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://linkedin.com/in/your-handle" className="mt-1" /></div>
        <div><label className="text-sm text-muted-foreground">{t('dashboard.linkedin.roleLabel')}</label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('dashboard.linkedin.rolePlaceholder')} className="mt-1" /></div>
        <div><label className="text-sm text-muted-foreground">{t('dashboard.linkedin.textLabel')}</label><Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={t('dashboard.linkedin.textPlaceholder')} className="mt-1" /></div>
        <Button onClick={optimize} disabled={loading} className="w-full">{loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('dashboard.linkedin.optimizing')}</> : t('dashboard.linkedin.optimizeButton')}</Button>
      </div>

      <div className="space-y-6">
        {!result && !loading && <div className="glass rounded-2xl p-10 grid place-items-center text-center min-h-[300px]"><div><Linkedin className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{t('dashboard.linkedin.emptyState')}</p></div></div>}
        {loading && <div className="glass rounded-2xl min-h-[300px] flex items-center justify-center"><AiLoader label={t('dashboard.linkedin.optimizing')} /></div>}
        {result && (
          <>
            <div className="glass rounded-2xl p-6 flex items-center gap-4">
              <div className="text-5xl font-extrabold" style={{ color }}>{score}<span className="text-lg text-muted-foreground">/100</span></div>
              <div><h3 className="font-semibold">{t('dashboard.linkedin.profileStrength')}</h3><p className="text-sm text-muted-foreground mt-1">{result.summary}</p></div>
            </div>
            <div className="glass rounded-2xl p-6">
              <h4 className="font-medium mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {t('dashboard.linkedin.headlineOptions')}</h4>
              <div className="space-y-2">{(result.headlineOptions || []).map((h, i) => (<div key={i} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm"><span>{h}</span><button onClick={() => copy(h)} className="text-muted-foreground hover:text-foreground shrink-0"><Copy className="h-4 w-4" /></button></div>))}</div>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3"><h4 className="font-medium">{t('dashboard.linkedin.aboutSection')}</h4><button onClick={() => copy(result.optimizedAbout)} className="text-muted-foreground hover:text-foreground"><Copy className="h-4 w-4" /></button></div>
              <Markdown content={result.optimizedAbout || ''} className="text-muted-foreground" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-5"><h4 className="font-medium text-sm mb-3">{t('dashboard.linkedin.keywordsToAdd')}</h4><div className="flex flex-wrap gap-2">{(result.keywordsToAdd || []).map((k) => <Badge key={k} variant="outline" className="border-primary/40 text-primary">{k}</Badge>)}</div></div>
              <div className="glass rounded-2xl p-5"><h4 className="font-medium text-sm mb-3 text-emerald-400">{t('dashboard.linkedin.quickWins')}</h4><ul className="space-y-1 text-sm text-muted-foreground">{(result.quickWins || []).map((q, i) => <li key={i} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />{q}</li>)}</ul></div>
            </div>
            <div className="glass rounded-2xl p-6"><h4 className="font-medium mb-3">{t('dashboard.linkedin.sectionTips')}</h4><div className="space-y-2">{(result.sectionTips || []).map((s, i) => (<div key={i} className="rounded-lg border border-border p-3"><div className="font-medium text-sm">{s.section}</div><div className="text-xs text-muted-foreground mt-1">{s.tip}</div></div>))}</div></div>
          </>
        )}
      </div>
    </div>
  );
}
