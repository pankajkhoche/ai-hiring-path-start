'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken, getUser, logout } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Shield, Users, TrendingUp, Sparkles, IndianRupee, Clock, LogOut, LayoutDashboard, Briefcase, Pencil, Trash2, ExternalLink } from 'lucide-react';
import ThemeToggle from '@/components/theme-toggle';
import LanguageSwitcher from '@/components/language-switcher';
import { useI18n } from '@/lib/i18n/context';

const EMPTY_JOB = { title: '', company: '', location: '', type: 'Full-time', ctc: '', skills: '', description: '', applyUrl: '', remote: false };

const COLORS = ['#6366f1', '#38bdf8', '#34d399', '#f59e0b'];

function Stat({ icon: Icon, label, value, color }) {
  return (<div className="glass rounded-2xl p-5"><div className="flex items-center justify-between"><div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: color + '22' }}><Icon className="h-5 w-5" style={{ color }} /></div><span className="text-3xl font-extrabold">{value}</span></div><div className="mt-3 text-sm text-muted-foreground">{label}</div></div>);
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [me, setMe] = useState(null);
  const [subs, setSubs] = useState(null);
  const [users, setUsers] = useState([]);
  const [grant, setGrant] = useState({ email: '', plan: 'premium', note: '' });
  const [jobs, setJobs] = useState([]);
  const [jobForm, setJobForm] = useState(EMPTY_JOB);
  const [editingJobId, setEditingJobId] = useState(null);
  const [savingJob, setSavingJob] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api('/auth/me').then(({ user }) => {
      if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) { toast.error(t('admin.adminOnlyToast')); router.replace('/dashboard'); return; }
      setMe(user); load(); loadJobs();
    }).catch(() => logout());
  }, [router]);

  function load() { api('/admin/subscriptions').then(setSubs).catch(() => {}); api('/admin/users').then(setUsers).catch(() => {}); }
  function loadJobs() { api('/admin/jobs').then(setJobs).catch(() => {}); }

  async function saveJob(e) {
    e.preventDefault();
    if (!jobForm.title || !jobForm.company || !jobForm.applyUrl) { toast.error(t('admin.jobRequiredFieldsToast')); return; }
    setSavingJob(true);
    try {
      if (editingJobId) { await api(`/admin/jobs/${editingJobId}`, { method: 'PUT', body: jobForm }); toast.success(t('admin.jobUpdatedToast')); }
      else { await api('/admin/jobs', { method: 'POST', body: jobForm }); toast.success(t('admin.jobPostedToast')); }
      setJobForm(EMPTY_JOB); setEditingJobId(null); loadJobs();
    } catch (err) { toast.error(err.message); }
    finally { setSavingJob(false); }
  }
  function editJob(j) {
    setEditingJobId(j.id);
    setJobForm({ title: j.title, company: j.company, location: j.location || '', type: j.type || 'Full-time', ctc: j.ctc || '', skills: (j.skills || []).join(', '), description: j.description || '', applyUrl: j.applyUrl || '', remote: !!j.remote });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEditJob() { setEditingJobId(null); setJobForm(EMPTY_JOB); }
  async function deleteJob(id) {
    try { await api(`/admin/jobs/${id}`, { method: 'DELETE' }); toast.success(t('admin.jobDeletedToast')); loadJobs(); }
    catch (err) { toast.error(err.message); }
  }

  async function doGrant(e) {
    e.preventDefault();
    try { await api('/admin/grant-access', { method: 'POST', body: grant }); toast.success(t('admin.accessGrantedToast', { plan: grant.plan, email: grant.email })); setGrant({ email: '', plan: 'premium', note: '' }); load(); }
    catch (err) { toast.error(err.message); }
  }
  async function revoke(email) {
    try { await api('/admin/revoke-access', { method: 'POST', body: { email } }); toast.success(t('admin.accessRevokedToast')); load(); }
    catch (err) { toast.error(err.message); }
  }

  if (!me) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Sparkles className="h-6 w-6 animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-2 font-bold"><Shield className="h-5 w-5 text-amber-400" /> {t('adminNav.console')}</div>
        <div className="flex items-center gap-3"><Link href="/dashboard"><Button variant="outline" size="sm"><LayoutDashboard className="h-4 w-4 mr-2" /> {t('adminNav.dashboard')}</Button></Link><LanguageSwitcher className="hidden sm:flex" /><ThemeToggle /><button onClick={logout} className="text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /></button></div>
      </header>
      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={Users} label={t('admin.totalUsers')} value={subs?.totalUsers ?? '—'} color="#6366f1" />
          <Stat icon={Clock} label={t('admin.trialUsers')} value={subs?.trial ?? '—'} color="#38bdf8" />
          <Stat icon={TrendingUp} label={t('admin.paid')} value={subs?.paid ?? '—'} color="#34d399" />
          <Stat icon={IndianRupee} label={t('admin.mrr')} value={subs ? '₹' + subs.mrr : '—'} color="#f59e0b" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4">{t('admin.planDistribution')}</h3>
            <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={subs?.planDistribution || []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>{(subs?.planDistribution || []).map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: '#0f0f14', border: '1px solid #27272a', borderRadius: 12 }} /></PieChart></ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-2 text-xs">{(subs?.planDistribution || []).map((e, i) => <span key={i} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /> {e.name} ({e.value})</span>)}</div>
          </div>

          <div className="glass rounded-2xl p-6 lg:col-span-2">
            <h3 className="font-semibold mb-1">{t('admin.grantAccessTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('admin.grantAccessSubtitle')}</p>
            <form onSubmit={doGrant} className="grid sm:grid-cols-2 gap-3">
              <Input placeholder={t('admin.emailPlaceholder')} value={grant.email} onChange={(e) => setGrant({ ...grant, email: e.target.value })} required />
              <Select value={grant.plan} onValueChange={(v) => setGrant({ ...grant, plan: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="starter">{t('admin.starter')}</SelectItem><SelectItem value="professional">{t('admin.professional')}</SelectItem><SelectItem value="premium">{t('admin.premium')}</SelectItem></SelectContent></Select>
              <Input placeholder={t('admin.notePlaceholder')} value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} className="sm:col-span-2" />
              <Button type="submit" className="sm:col-span-2">{t('admin.grantButton')}</Button>
            </form>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-1 flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" /> {editingJobId ? t('admin.editJob') : t('admin.postJob')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('admin.postJobSubtitle')}</p>
          <form onSubmit={saveJob} className="grid sm:grid-cols-2 gap-3">
            <Input placeholder={t('admin.jobTitlePlaceholder')} value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} required />
            <Input placeholder={t('admin.companyPlaceholder')} value={jobForm.company} onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })} required />
            <Input placeholder={t('admin.locationPlaceholder')} value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} />
            <Select value={jobForm.type} onValueChange={(v) => setJobForm({ ...jobForm, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Full-time">{t('admin.jobTypeFullTime')}</SelectItem><SelectItem value="Part-time">{t('admin.jobTypePartTime')}</SelectItem><SelectItem value="Contract">{t('admin.jobTypeContract')}</SelectItem><SelectItem value="Internship">{t('admin.jobTypeInternship')}</SelectItem></SelectContent>
            </Select>
            <Input placeholder={t('admin.ctcPlaceholder')} value={jobForm.ctc} onChange={(e) => setJobForm({ ...jobForm, ctc: e.target.value })} />
            <Input placeholder={t('admin.applyLinkPlaceholder')} value={jobForm.applyUrl} onChange={(e) => setJobForm({ ...jobForm, applyUrl: e.target.value })} required />
            <Input placeholder={t('admin.skillsPlaceholder')} value={jobForm.skills} onChange={(e) => setJobForm({ ...jobForm, skills: e.target.value })} className="sm:col-span-2" />
            <Textarea placeholder={t('admin.descriptionPlaceholder')} value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} className="sm:col-span-2" rows={3} />
            <div className="flex items-center gap-2 sm:col-span-2"><Switch checked={jobForm.remote} onCheckedChange={(v) => setJobForm({ ...jobForm, remote: v })} /> <span className="text-sm text-muted-foreground">{t('admin.remoteFriendly')}</span></div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={savingJob} className="flex-1">{editingJobId ? t('admin.saveChanges') : t('admin.postJobButton')}</Button>
              {editingJobId && <Button type="button" variant="outline" onClick={cancelEditJob}>{t('admin.cancel')}</Button>}
            </div>
          </form>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">{t('admin.postedJobs', { count: jobs.length })}</h3>
          <div className="space-y-3">
            {jobs.length === 0 && <p className="text-sm text-muted-foreground">{t('admin.noJobsPosted')}</p>}
            {jobs.map((j) => (
              <div key={j.id} className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><span className="font-medium">{j.title}</span><span className="text-muted-foreground text-sm">· {j.company}</span>{j.remote && <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-xs">{t('dashboard.jobs.remote')}</Badge>}</div>
                  <div className="text-xs text-muted-foreground mt-1">{j.location} {j.ctc && `· ${j.ctc}`}</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">{(j.skills || []).map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground p-2"><ExternalLink className="h-4 w-4" /></a>
                  <button onClick={() => editJob(j)} className="text-muted-foreground hover:text-foreground p-2"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => deleteJob(j.id)} className="text-rose-400 hover:text-rose-300 p-2"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">{t('admin.allUsers', { count: users.length })}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-2 font-medium">{t('admin.name')}</th><th className="font-medium">{t('admin.email')}</th><th className="font-medium">{t('admin.role')}</th><th className="font-medium">{t('admin.access')}</th><th className="font-medium">{t('admin.action')}</th></tr></thead>
              <tbody>{users.map((u) => (<tr key={u.id} className="border-b border-border/50"><td className="py-3">{u.name}</td><td className="text-muted-foreground">{u.email}</td><td><Badge variant="outline" className="text-xs">{u.role}</Badge></td><td><Badge variant="outline" className="border-primary/40 text-primary text-xs">{u.access?.label}</Badge></td><td>{u.manualGrant && <Button size="sm" variant="ghost" className="text-rose-400 h-7" onClick={() => revoke(u.email)}>{t('admin.revoke')}</Button>}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
