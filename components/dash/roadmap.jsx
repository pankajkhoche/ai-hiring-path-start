'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Map, Flag, RotateCcw } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import AiLoader from '@/components/ui/ai-loader';

export default function Roadmap() {
  const { t } = useI18n();
  const [form, setForm] = useState({ domain: '', role: '', experienceLevel: 'fresher', yearsOfExperience: '', timelineMonths: '6' });
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);

  async function generate(e) {
    e.preventDefault();
    if (!form.domain.trim() || !form.role.trim()) { toast.error(t('dashboard.roadmap.enterFieldsToast')); return; }
    setLoading(true);
    try {
      const data = await api('/ai/roadmap/generate', {
        method: 'POST',
        body: {
          domain: form.domain, role: form.role, experienceLevel: form.experienceLevel,
          yearsOfExperience: form.experienceLevel === 'experienced' ? Number(form.yearsOfExperience) || 0 : null,
          timelineMonths: Number(form.timelineMonths),
        },
      });
      setPlan(data);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }

  if (plan) return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="glass rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold">{form.role} · {form.domain}</h2><p className="text-muted-foreground text-sm mt-1">{plan.summary}</p></div>
          <Button variant="outline" size="sm" onClick={() => setPlan(null)}><RotateCcw className="h-4 w-4 mr-1.5" /> {t('dashboard.roadmap.newPlan')}</Button>
        </div>
      </div>
      {plan.months.map((m) => (
        <div key={m.month} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3"><Badge className="bg-primary">{t('dashboard.roadmap.monthN', { n: m.month })}</Badge><h3 className="font-semibold">{m.theme}</h3></div>
          <div className="space-y-3">
            {(m.weeks || []).map((w) => (
              <div key={w.week} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{t('dashboard.roadmap.weekN', { n: w.week, focus: w.focus })}</p>
                {w.resources?.length > 0 && <ul className="mt-1.5 text-xs text-muted-foreground space-y-0.5">{w.resources.map((r, i) => <li key={i}>• {r}</li>)}</ul>}
              </div>
            ))}
          </div>
          {m.milestone && <div className="mt-3 flex items-start gap-2 text-sm text-emerald-300"><Flag className="h-4 w-4 mt-0.5 shrink-0" /> {m.milestone}</div>}
        </div>
      ))}
    </div>
  );

  if (loading) return (
    <div className="max-w-xl mx-auto glass rounded-2xl min-h-[420px] flex items-center justify-center"><AiLoader label={t('dashboard.roadmap.generating')} /></div>
  );

  return (
    <div className="max-w-xl mx-auto glass rounded-2xl p-8">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-amber-300 grid place-items-center mb-4"><Map className="h-7 w-7" /></div>
      <h2 className="text-2xl font-bold">{t('dashboard.roadmap.heading')}</h2>
      <p className="text-muted-foreground mt-1">{t('dashboard.roadmap.subtitle')}</p>
      <form onSubmit={generate} className="mt-6 space-y-4">
        <div><label className="text-sm text-muted-foreground">{t('dashboard.roadmap.domainLabel')}</label><Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="mt-1" placeholder={t('dashboard.roadmap.domainPlaceholder')} /></div>
        <div><label className="text-sm text-muted-foreground">{t('dashboard.roadmap.roleLabel')}</label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1" placeholder={t('dashboard.roadmap.rolePlaceholder')} /></div>
        <div>
          <label className="text-sm text-muted-foreground">{t('dashboard.roadmap.experienceLevelLabel')}</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button type="button" onClick={() => setForm({ ...form, experienceLevel: 'fresher' })} className={`rounded-lg border px-4 py-2 text-sm ${form.experienceLevel === 'fresher' ? 'border-primary bg-primary/10' : 'border-border'}`}>{t('dashboard.roadmap.fresher')}</button>
            <button type="button" onClick={() => setForm({ ...form, experienceLevel: 'experienced' })} className={`rounded-lg border px-4 py-2 text-sm ${form.experienceLevel === 'experienced' ? 'border-primary bg-primary/10' : 'border-border'}`}>{t('dashboard.roadmap.experienced')}</button>
          </div>
        </div>
        {form.experienceLevel === 'experienced' && (
          <div><label className="text-sm text-muted-foreground">{t('dashboard.roadmap.yearsOfExperience')}</label><Input type="number" min="0" step="0.5" value={form.yearsOfExperience} onChange={(e) => setForm({ ...form, yearsOfExperience: e.target.value })} className="mt-1" placeholder={t('dashboard.roadmap.yearsPlaceholder')} /></div>
        )}
        <div>
          <label className="text-sm text-muted-foreground">{t('dashboard.roadmap.timelineLabel')}</label>
          <Select value={form.timelineMonths} onValueChange={(v) => setForm({ ...form, timelineMonths: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="3">{t('dashboard.roadmap.months3')}</SelectItem><SelectItem value="6">{t('dashboard.roadmap.months6')}</SelectItem><SelectItem value="12">{t('dashboard.roadmap.months12')}</SelectItem></SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={loading} className="w-full">{t('dashboard.roadmap.generateButton')}</Button>
      </form>
    </div>
  );
}
