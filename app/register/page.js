'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, setAuth } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CANDIDATE' });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await api('/auth/register', { method: 'POST', body: form });
      setAuth(token, user);
      toast.success(t('auth.register.successToast'));
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }

  const perks = t('auth.register.perks');

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 order-2 lg:order-1">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2 font-bold text-lg"><Sparkles className="h-6 w-6 text-primary" /> AI Hiring Path</div>
          <h1 className="text-2xl font-bold">{t('auth.register.heading')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('auth.register.subheading')}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2"><Label>{t('auth.register.fullName')}</Label><Input required value={form.name} onChange={set('name')} placeholder="Aarav Sharma" /></div>
            <div className="space-y-2"><Label>{t('auth.register.email')}</Label><Input type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" /></div>
            <div className="space-y-2"><Label>{t('auth.register.password')}</Label><Input type="password" required minLength={6} value={form.password} onChange={set('password')} placeholder={t('auth.register.passwordHint')} /></div>
            <div className="space-y-2">
              <Label>{t('auth.register.iAmA')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {[{ r: 'CANDIDATE', label: t('auth.register.roleCandidate') }, { r: 'RECRUITER', label: t('auth.register.roleRecruiter') }].map(({ r, label }) => (
                  <button type="button" key={r} onClick={() => setForm((f) => ({ ...f, role: r }))} className={`rounded-lg border px-3 py-2 text-sm capitalize transition ${form.role === r ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-muted-foreground'}`}>{label}</button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.register.submit')}</Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground text-center">{t('auth.register.alreadyHaveAccount')} <Link href="/login" className="text-primary hover:underline">{t('auth.register.signIn')}</Link></p>
        </motion.div>
      </div>
      <div className="hidden lg:flex flex-col justify-center p-12 relative overflow-hidden bg-gradient-to-bl from-primary/10 via-background to-background order-1 lg:order-2">
        <div className="absolute inset-0 grid-bg radial-fade opacity-60" />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-10"><div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-amber-300 grid place-items-center"><Sparkles className="h-5 w-5" /></div> AI Hiring Path</Link>
          <h2 className="text-4xl font-bold leading-tight">{t('auth.register.panelTitlePrefix')} <span className="gradient-text">{t('auth.register.panelTitleEmphasis')}</span>.</h2>
          <ul className="mt-8 space-y-3">
            {perks.map((p) => (<li key={p} className="flex items-center gap-3 text-muted-foreground"><span className="h-6 w-6 rounded-full bg-emerald-500/15 grid place-items-center"><Check className="h-4 w-4 text-emerald-400" /></span>{p}</li>))}
          </ul>
        </div>
      </div>
    </div>
  );
}
