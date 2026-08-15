'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AreaChart, Area, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { FileSearch, Mic, Gauge, TrendingUp, Sparkles, Loader2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n/context';

function Ring({ value, label, icon: Icon, color }) {
  const v = value ?? 0;
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: color + '22' }}><Icon className="h-5 w-5" style={{ color }} /></div>
        <span className="text-3xl font-extrabold">{value == null ? '—' : v}{value != null && <span className="text-sm text-muted-foreground">/100</span>}</span>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} /></div>
    </div>
  );
}

export default function Overview({ user }) {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [recs, setRecs] = useState(null);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => { api('/dashboard/stats').then(setStats).catch(() => setStats({})); }, []);

  async function getRecs() {
    setRecLoading(true);
    try { const d = await api('/dashboard/recommendations'); setRecs(d.recommendations || []); } catch {} finally { setRecLoading(false); }
  }

  if (!stats) return <div className="grid md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('dashboard.overview.welcomeBack', { name: user.name?.split(' ')[0] })} 👋</h2>
        <p className="text-muted-foreground">{t('dashboard.overview.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Ring value={stats.atsScore} label={t('dashboard.overview.latestAtsScore')} icon={FileSearch} color="#6366f1" />
        <Ring value={stats.resumeHealth} label={t('dashboard.overview.resumeHealth')} icon={Gauge} color="#38bdf8" />
        <Ring value={stats.interviewReadiness} label={t('dashboard.overview.interviewReadiness')} icon={TrendingUp} color="#34d399" />
        <div className="glass rounded-2xl p-5"><div className="flex items-center justify-between"><div className="h-10 w-10 rounded-xl bg-violet-500/15 grid place-items-center"><Mic className="h-5 w-5 text-violet-400" /></div><span className="text-3xl font-extrabold">{stats.interviewsTaken || 0}</span></div><div className="mt-3 text-sm text-muted-foreground">{t('dashboard.overview.interviewsTaken')}</div><div className="mt-2 text-xs text-muted-foreground">{t('dashboard.overview.keepPracticing')}</div></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{t('dashboard.overview.atsScoreTrend')}</h3><TrendingUp className="h-4 w-4 text-muted-foreground" /></div>
          {stats.atsTrend?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.atsTrend}><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="name" stroke="#666" fontSize={12} /><Tooltip contentStyle={{ background: '#0f0f14', border: '1px solid #27272a', borderRadius: 12 }} /><Area type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={2} fill="url(#g1)" /></AreaChart>
            </ResponsiveContainer>
          ) : <Empty text={t('dashboard.overview.runFirstAts')} />}
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">{t('dashboard.overview.skillRadar')}</h3>
          {stats.radar?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={stats.radar}><PolarGrid stroke="#27272a" /><PolarAngleAxis dataKey="area" tick={{ fill: '#888', fontSize: 11 }} /><Radar dataKey="current" stroke="#34d399" fill="#34d399" fillOpacity={0.3} /><Radar dataKey="required" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} /></RadarChart>
            </ResponsiveContainer>
          ) : <Empty text={t('dashboard.overview.runSkillGap')} />}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">{t('dashboard.overview.weeklyActivity')}</h3>
          <ResponsiveContainer width="100%" height={200}><BarChart data={stats.weekly}><XAxis dataKey="day" stroke="#666" fontSize={12} /><Tooltip contentStyle={{ background: '#0f0f14', border: '1px solid #27272a', borderRadius: 12 }} /><Bar dataKey="actions" fill="#38bdf8" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="h-4 w-4" /> {t('dashboard.overview.recentActivity')}</h3>
          <div className="space-y-3">{stats.recentActivity?.length ? stats.recentActivity.map((a) => (<div key={a.id} className="flex items-start gap-3 text-sm"><div className="h-2 w-2 rounded-full bg-primary mt-1.5" /><div><div>{a.message}</div><div className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</div></div></div>)) : <Empty text={t('dashboard.overview.noActivityYet')} small />}</div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {t('dashboard.overview.aiRecommendations')}</h3></div>
          {recs ? (
            <div className="space-y-3">{recs.map((r, i) => (<div key={i} className="rounded-lg border border-border p-3"><div className="font-medium text-sm">{r.title}</div><div className="text-xs text-muted-foreground mt-1">{r.detail}</div></div>))}</div>
          ) : (
            <div className="text-center py-6"><p className="text-sm text-muted-foreground mb-4">{t('dashboard.overview.getNextSteps')}</p><Button size="sm" onClick={getRecs} disabled={recLoading} className="">{recLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('dashboard.overview.generateRecommendations')}</Button></div>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ text, small }) {
  return <div className={`grid place-items-center text-muted-foreground text-sm ${small ? 'py-6' : 'h-[200px]'}`}>{text}</div>;
}
