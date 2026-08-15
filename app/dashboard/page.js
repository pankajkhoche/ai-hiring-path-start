'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, LayoutDashboard, FileSearch, MessagesSquare, Mic, Target, Briefcase, CreditCard, LogOut, Shield, Menu, X, Linkedin, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, getToken, getUser, logout, updateUser } from '@/lib/api';
import Overview from '@/components/dash/overview';
import ATS from '@/components/dash/ats';
import LinkedIn from '@/components/dash/linkedin';
import Coach from '@/components/dash/coach';
import JobPrep from '@/components/dash/job-prep';
import Skills from '@/components/dash/skills';
import Jobs from '@/components/dash/jobs';
import Roadmap from '@/components/dash/roadmap';
import Billing from '@/components/dash/billing';
import { LogoMark } from '@/components/logo';
import ThemeToggle from '@/components/theme-toggle';
import LanguageSwitcher from '@/components/language-switcher';
import { useI18n } from '@/lib/i18n/context';

const NAV = [
  { id: 'overview', key: 'overview', icon: LayoutDashboard },
  { id: 'ats', key: 'ats', icon: FileSearch },
  { id: 'linkedin', key: 'linkedin', icon: Linkedin },
  { id: 'coach', key: 'coach', icon: MessagesSquare },
  { id: 'interview', key: 'jobPrep', icon: Mic },
  { id: 'skills', key: 'skills', icon: Target },
  { id: 'roadmap', key: 'roadmap', icon: Map },
  { id: 'jobs', key: 'jobs', icon: Briefcase },
  { id: 'billing', key: 'billing', icon: CreditCard },
];

export default function Dashboard() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [active, setActive] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    setUser(getUser());
    api('/auth/me').then(({ user }) => { setUser(user); updateUser(user); }).catch((e) => { if (e.status === 401) logout(); });
  }, [router]);

  if (!user) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Sparkles className="h-6 w-6 animate-pulse" /></div>;

  const access = user.access || {};
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);

  const views = { overview: <Overview user={user} />, ats: <ATS access={access} />, linkedin: <LinkedIn />, coach: <Coach />, interview: <JobPrep />, skills: <Skills />, roadmap: <Roadmap />, jobs: <Jobs />, billing: <Billing user={user} /> };

  const SidebarInner = () => (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2 font-bold px-4 h-16 border-b border-sidebar-border">
        <LogoMark className="h-8 w-8" />
        AI Hiring Path
      </Link>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => { setActive(n.id); setMobileOpen(false); }} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active === n.id ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}>
            <n.icon className="h-4 w-4" /> {t(`dashboardNav.${n.key}`)}
          </button>
        ))}
        {isAdmin && <Link href="/admin" className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-amber-300 hover:bg-sidebar-accent"><Shield className="h-4 w-4" /> {t('dashboardMisc.adminPanel')}</Link>}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-amber-300 grid place-items-center font-semibold text-sm">{user.name?.[0]?.toUpperCase()}</div>
          <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{user.name}</div><div className="text-xs text-muted-foreground truncate">{user.email}</div></div>
          <button onClick={logout} className="text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border flex-col z-40"><SidebarInner /></aside>
      {mobileOpen && (<div className="lg:hidden fixed inset-0 z-50 flex"><div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} /><aside className="relative w-64 bg-sidebar border-r border-sidebar-border"><SidebarInner /></aside></div>)}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
            <h1 className="font-semibold text-lg capitalize">{t(`dashboardNav.${NAV.find((n) => n.id === active)?.key}`)}</h1>
          </div>
          <div className="flex items-center gap-3">
            {access.source === 'trial' && <Badge variant="outline" className="hidden sm:flex border-emerald-500/40 bg-emerald-500/10 text-emerald-300">{t('dashboardMisc.trialBadge', { days: access.trialDaysLeft })}</Badge>}
            {access.source === 'admin' && <Badge variant="outline" className="hidden sm:flex border-amber-500/40 bg-amber-500/10 text-amber-300">{t('dashboardMisc.adminAccessBadge')}</Badge>}
            {access.source === 'manual_grant' && <Badge variant="outline" className="hidden sm:flex border-primary/40 bg-primary/10 text-primary">{access.label}</Badge>}
            <LanguageSwitcher className="hidden sm:flex" />
            <ThemeToggle />
          </div>
        </header>
        <main className="p-4 md:p-8">{views[active]}</main>
      </div>
    </div>
  );
}
