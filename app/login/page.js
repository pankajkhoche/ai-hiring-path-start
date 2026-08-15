'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, setAuth } from '@/lib/api';
import { useI18n } from '@/lib/i18n/context';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setAuth(token, user);
      toast.success(t('auth.login.welcomeBack', { name: user.name.split(' ')[0] }));
      router.push(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="absolute inset-0 grid-bg radial-fade opacity-60" />
        <Link href="/" className="relative flex items-center gap-2 font-bold text-lg">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-amber-300 grid place-items-center"><Sparkles className="h-5 w-5" /></div>
          AI Hiring Path
        </Link>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight">{t('auth.login.panelTitle')} <span className="gradient-text">{t('auth.login.panelTitleEmphasis')}</span>.</h2>
          <p className="mt-4 text-muted-foreground text-lg">{t('auth.login.panelSubtitle')}</p>
        </div>
        <p className="relative text-sm text-muted-foreground">{t('auth.login.panelTrust')}</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2 font-bold text-lg"><Sparkles className="h-6 w-6 text-primary" /> AI Hiring Path</div>
          <h1 className="text-2xl font-bold">{t('auth.login.heading')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('auth.login.subheading')}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label>{t('auth.login.email')}</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label>{t('auth.login.password')}</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.login.submit')}</Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground text-center">{t('auth.login.noAccount')} <Link href="/register" className="text-primary hover:underline">{t('auth.login.startTrial')}</Link></p>
        </motion.div>
      </div>
    </div>
  );
}
