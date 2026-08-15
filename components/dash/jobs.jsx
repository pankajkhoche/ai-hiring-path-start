'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

export default function Jobs() {
  const { t } = useI18n();
  const [jobs, setJobs] = useState(null);
  useEffect(() => { api('/jobs').then(setJobs).catch(() => setJobs([])); }, []);

  async function toggleSave(job) {
    setJobs((js) => js.map((j) => j.id === job.id ? { ...j, saved: !j.saved } : j));
    try { await api('/jobs/save', { method: 'POST', body: { jobId: job.id } }); }
    catch (e) { toast.error(e.message); }
  }

  function apply(job) {
    if (!job.applyUrl) return;
    window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
  }

  if (!jobs) return <div className="grid md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-bold">{t('dashboard.jobs.title')}</h2><p className="text-muted-foreground text-sm">{t('dashboard.jobs.subtitle')}</p></div>
      <div className="grid md:grid-cols-2 gap-4">
        {jobs.map((j) => (
          <div key={j.id} className="glass rounded-2xl p-6 flex flex-col">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl bg-secondary grid place-items-center font-bold">{j.company[0]}</div><div><h3 className="font-semibold">{j.title}</h3><p className="text-sm text-muted-foreground">{j.company}</p></div></div>
              <button onClick={() => toggleSave(j)} className="text-muted-foreground hover:text-primary">{j.saved ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}</button>
            </div>
            {j.description && <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{j.description}</p>}
            <div className="flex flex-wrap gap-2 mt-4">{(j.skills || []).map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
            <div className="flex items-center justify-between mt-4 text-sm">
              <div className="flex items-center gap-3 text-muted-foreground"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {j.location}</span>{j.remote && <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">{t('dashboard.jobs.remote')}</Badge>}</div>
              <span className="font-medium">{j.ctc}</span>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="text-sm">{j.match != null ? <><span className="font-bold text-emerald-400">{j.match}%</span> <span className="text-muted-foreground">{t('dashboard.jobs.match')}</span></> : <span className="text-muted-foreground">{t('dashboard.jobs.newlyPosted')}</span>}</div>
              <Button size="sm" className="gap-1.5" disabled={!j.applyUrl} onClick={() => apply(j)}>
                {t('dashboard.jobs.applyButton')} <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
