'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { Loader2, Target } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

export default function Skills({ provider }) {
  const { t } = useI18n();
  const [skills, setSkills] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function analyze() {
    if (!role.trim()) { toast.error(t('dashboard.skills.enterRoleToast')); return; }
    setLoading(true); setResult(null);
    try { const d = await api('/ai/skills/gap', { method: 'POST', body: { currentSkills: skills, targetRole: role, provider } }); setResult(d); toast.success(t('dashboard.skills.readyToast')); }
    catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }

  const impColor = { high: 'border-rose-500/40 text-rose-300', medium: 'border-amber-500/40 text-amber-300', low: 'border-sky-500/40 text-sky-300' };

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4"><Target className="h-5 w-5 text-violet-400" /><h3 className="font-semibold">{t('dashboard.skills.title')}</h3></div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="text-sm text-muted-foreground">{t('dashboard.skills.currentSkillsLabel')}</label><Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder={t('dashboard.skills.currentSkillsPlaceholder')} className="mt-1" /></div>
          <div><label className="text-sm text-muted-foreground">{t('dashboard.skills.targetRoleLabel')}</label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('dashboard.skills.targetRolePlaceholder')} className="mt-1" /></div>
        </div>
        <Button onClick={analyze} disabled={loading} className="mt-4">{loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('dashboard.skills.analyzing')}</> : t('dashboard.skills.analyzeButton')}</Button>
      </div>

      {result && (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass rounded-2xl p-6"><h4 className="font-medium mb-4">{t('dashboard.skills.skillRadar')}</h4><ResponsiveContainer width="100%" height={280}><RadarChart data={result.radar || []}><PolarGrid stroke="#27272a" /><PolarAngleAxis dataKey="area" tick={{ fill: '#888', fontSize: 11 }} /><Radar name="Current" dataKey="current" stroke="#34d399" fill="#34d399" fillOpacity={0.3} /><Radar name="Required" dataKey="required" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} /></RadarChart></ResponsiveContainer></div>
            <div className="glass rounded-2xl p-6"><h4 className="font-medium mb-4">{t('dashboard.skills.missingSkills')}</h4><div className="space-y-2">{(result.missingSkills || []).map((m, i) => (<div key={i} className="flex items-center justify-between rounded-lg border border-border p-3"><span className="text-sm">{m.skill}</span><div className="flex items-center gap-2"><Badge variant="outline" className={impColor[m.importance] || ''}>{m.importance}</Badge><span className="text-xs text-muted-foreground">~{m.weeksToLearn}w</span></div></div>))}</div></div>
          </div>
          <div className="glass rounded-2xl p-6">
            <h4 className="font-medium mb-4">{t('dashboard.skills.learningRoadmap')}</h4>
            <div className="space-y-3">{(result.roadmap || []).map((r, i) => (<div key={i} className="flex gap-4"><div className="h-8 w-8 rounded-full bg-primary grid place-items-center text-sm font-semibold shrink-0">{r.week}</div><div className="flex-1 rounded-lg border border-border p-3"><div className="font-medium text-sm">{r.focus}</div><div className="text-xs text-muted-foreground mt-1">{(r.resources || []).join(' • ')}</div></div></div>))}</div>
          </div>
        </>
      )}
    </div>
  );
}
